from fastapi import FastAPI, File, UploadFile, Body
from fastapi.responses import Response
import uvicorn
import shutil
import os
import io
import base64
import json
from datetime import datetime, timedelta

# New imports for the updated logic
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# Existing imports
import whisper
from openai import OpenAI
import prompts
import example_queries
from tmp import api_key

from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict

sample_query = example_queries.dermatological_log

OPENAI_KEY = api_key.KEY

model_type = "gpt-4o-mini"
token_limit = 500

app = FastAPI()

# --- Global Variables & Data ---
# These will be loaded at startup
model = None
openai_client = None
df = pd.DataFrame()

# ------------------------------------------------------------------------

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.on_event("startup")
def load_dependencies():
    """Load all models and data at application startup."""
    global model, openai_client, df
    
    # Load Whisper model
    print("Loading Whisper model...")
    model = whisper.load_model("base.en")
    print("Whisper model loaded.")

    # Connect to OpenAI
    print("Connecting to OpenAI...")
    openai_client = OpenAI(api_key=OPENAI_KEY)
    print("Connected to OpenAI.")
    
    # Load patient data from CSV
    print("Loading patient data...")
    try:
        df = pd.read_csv("tmp/mock_data.csv")
        print(f"Patient data loaded successfully. {len(df)} records found.")
    except FileNotFoundError:
        print("WARNING: mock_data.csv not found. Patient-related endpoints will not work.")
        # Define columns to avoid errors if the file is missing
        df = pd.DataFrame(columns=['patientUid', 'createdAt', 'userText', 'followUps?'])

# ------------------------------------------------------------------------

async def query_llm(messages: list[dict[str, any]], token_limit=token_limit, temperature=0.7):
	response = None
	try:
		response = openai_client.chat.completions.create(
			model=model_type,
			messages=messages,
			max_tokens=token_limit
		)
		print("API request successful.")
	except Exception as e:
		print(f"An error occurred during the API request: {e}")
	return response

# ------------------------------------------------------------------------

def encode_image_to_base64(img_path: str):
	try:
		with open(img_path, "rb") as img_file:
			encoded_image = base64.b64encode(img_file.read()).decode("utf-8")
	except FileNotFoundError:
		print(f"Error: Image file not found at {img_path}")
		encoded_image = None
	return encoded_image

@app.post("/transcribe_image")
async def transcribe_image(file: UploadFile = File(...)) -> str:
	temp_file_path = f"temp_{file.filename}"
	try:
		# Save the uploaded file temporarily
		with open(temp_file_path, "wb") as buffer:
			shutil.copyfileobj(file.file, buffer)

		# Encode the image
		encoded = encode_image_to_base64(temp_file_path)

		messages = [
			{
				"role": "user",
				"content": [
					{"type": "text", "text": prompts.image_prompt},
					{
						"type": "image_url",
						"image_url": {
							"url": f"data:image/jpeg;base64,{encoded}",
						},
					},
				],
			}
		]

		response = await query_llm(messages)

		# Return the transcribed image
		return response.choices[0].message.content
	finally:
		if os.path.exists(temp_file_path):
			os.remove(temp_file_path)

# ------------------------------------------------------------------------

@app.post("/transcribe_audio")
async def transcribe_audio(file: UploadFile = File(...)) -> str:
	temp_file_path = f"temp_{file.filename}"
	try:
		# Save the uploaded file temporarily
		with open(temp_file_path, "wb") as buffer:
			shutil.copyfileobj(file.file, buffer)

		# Transcribe the audio file using Whisper
		result = model.transcribe(f"temp_{file.filename}")

		# Return the transcribed text
		return result["text"]
	finally:
		if os.path.exists(temp_file_path):
			os.remove(temp_file_path)

# ------------------------------------------------------------------------

async def _followup_question_generator(records: str) -> list[str]:
	prompt_1 = prompts.followup_questions_prompt.format(record=records)

	messages= [
		{"role": "user", "content": prompt_1}
	]

	response = await query_llm(messages, temperature=0.3)

	# print(response.choices[0].message.content)

	content1 = response.choices[0].message.content
	data1 = json.loads(content1)

	followup_questions = data1['followup_questions']

	return followup_questions

@app.post("/followup")
async def followup_question_generator(records: str = Body(...)) -> list[str]:
	return await _followup_question_generator(records)

@app.get("/test_followup")
async def test_followup():
      return await _followup_question_generator(sample_query)

# ------------------------------------------------------------------------

async def _patient_sample_response(records: str, questions: str) -> dict:
	patient_prompt = prompts.example_patient_prompt.format(record = records, followup_questions = questions)

	messages = [
		{"role": "user", "content": patient_prompt}
	]

	response = await query_llm(messages, temperature=0.3)

	# print(response.choices[0].message.content)

	patient_content = response.choices[0].message.content
	patient_data = json.loads(patient_content)

	followup_answers = patient_data

	return followup_answers

@app.post("/sample_response")
async def patient_sample_response(records: str, questions: str) -> dict:
	return await _patient_sample_response(records, questions)

# -------------------------------------------------------------------------------------------------

async def _generate_summary_for_patient(patient_uid: str) -> dict:
    """Core logic to generate a detailed summary for a specific patient."""
    if df.empty or patient_uid not in df['patientUid'].values:
        return {"error": f"Patient '{patient_uid}' not found or no data available."}

    four_weeks_ago = datetime.now() - timedelta(weeks=4)
    timestamp_cutoff = four_weeks_ago.timestamp()
    
    recent_patient_df = df[(df['patientUid'] == patient_uid) & (df['createdAt'] > timestamp_cutoff)]

    if recent_patient_df.empty:
        return {"error": "No recent records found for this patient."}

    dates = [datetime.fromtimestamp(ts) for ts in recent_patient_df['createdAt']]
    records = list(recent_patient_df['userText'])
    followup_answers = list(recent_patient_df['followUps?']) 

    summary_prompt = prompts.general_summary_prompt.format(
        records=records,
        dates=[d.strftime("%Y-%m-%d") for d in dates],
        followup_answers=followup_answers
    )

    messages = [{"role": "user", "content": summary_prompt}]
    response = await query_llm(messages, token_limit=1500, temperature=0.3)

    if not response:
        return {"error": "Failed to get a response from the LLM."}
        
    summary_data = json.loads(response.choices[0].message.content)
    
    summary_data['dates'] = [d.strftime("%Y-%m-%d %H:%M:%S") for d in dates]
    summary_data['summary']['onset'] = (max(dates) - min(dates)).days if dates else 0

    return summary_data

@app.post("/summarize_patient/{patient_uid}")
async def summarize_patient(patient_uid: str):
    """Endpoint to get a full summary for a patient."""
    return await _generate_summary_for_patient(patient_uid)

# ------------------------------------------------------------------------

def _get_highlights_data(patient_summary: dict) -> dict:
    symptom_list_ = list(patient_summary['importance'].keys())
        
    score_list = []
    for symptom in symptom_list_:
        score_list.append(patient_summary['importance'][symptom]['score'])
        
    score_array = np.array(score_list)
    summed_array = np.sum(score_array, axis = 1)
            
    idx = np.argsort(summed_array)[::-1][:2]
    main_symptoms = np.array(symptom_list_)[idx]
    
    recent_data = score_array[idx,-2:]
    
    rate_of_change = np.round((recent_data[:,1] - recent_data[:,0])/recent_data[:,0],4)
    
    trend = ["steady", "steady"]
    if rate_of_change[0]>0:
        trend[0] = "Worsening"
    elif rate_of_change[0]<0:
        trend[0] = "Improving"
    if rate_of_change[1]>0:
        trend[1] = "Worsening"
    elif rate_of_change[1]<0:
        trend[1] = "Improving"
    
    result = [
        {
            "symptom": main_symptoms[0],
            "trend": trend[0],
            "rate": rate_of_change[0]
        },
        {
            "symptom": main_symptoms[1],
            "trend": trend[1],
            "rate": rate_of_change[1]
        },
    ]
    
    return result

@app.get("/analysis/highlights/{patient_uid}")
async def get_patient_highlights(patient_uid: str):
    """Endpoint to get the top 2 symptom trends for a patient."""
    summary = await _generate_summary_for_patient(patient_uid)
    return _get_highlights_data(summary)

# ------------------------------------------------------------------------

@app.post("/plot_summary")
def plot_summary(summarized: dict):
    dates = []
    for dt_str in summarized['dates']:
        dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        dates.append(str(dt.month)+"/"+str(dt.day)+", "+str(dt.hour)+":"+str(dt.minute))
    num_days = len(dates)
    
    
    symptom_list_ = list(summarized['importance'].keys())
        
    score_list = []
    for symptom in symptom_list_:
        score_list.append(summarized['importance'][symptom]['score'])
            
    scores_arr = (np.array(score_list).T)/len(symptom_list_)


    # Bar colors (palette instead of one color)
    colors = sns.color_palette("pastel", len(symptom_list_)) 
    
    plt.figure(figsize=(10,3))
    bottom = np.zeros(num_days)  # initialize bottom positions

    for i in range(len(symptom_list_)):
        plt.bar(dates, scores_arr[:, i], bottom=bottom, color=colors[i], label=symptom_list_[i])
        bottom += scores_arr[:,i]  # update bottom for next layer
        
        
    # Remove spines for cleaner look
    for spine in ["top", "right"]:
        plt.gca().spines[spine].set_visible(False)
        
    # Add gridlines (light + dashed for readability)
    plt.grid(axis="y", linestyle="--", alpha=0.6)

    plt.ylabel("Intensity(%)", fontsize=12, labelpad=10)
    plt.title("Symptom Change Trend", fontsize=16, fontweight="bold", pad=15)
    plt.ylim(0, 100) 
    plt.legend()
    
    buffer = io.BytesIO()
    plt.savefig(buffer, format="png", bbox_inches='tight')
    plt.close()
    buffer.seek(0)

    return Response(content=buffer.getvalue(), media_type="image/png")

# ------------------------------------------------------------------------

@app.get("/test_full_pipeline/{patient_uid}")
async def test_full_pipeline(patient_uid: str):
    """A test endpoint to run the summary and plotting for a patient."""
    summarized_data = await _generate_summary_for_patient(patient_uid)
    if "error" in summarized_data:
        return summarized_data
    return plot_summary(summarized_data)

# ------------------------------------------------------------------------


class Record(BaseModel):
    patientUid: str
    userText: str
    createdAt: int
    # Use Optional for fields that might be null or missing
    followUps: Optional[Any] = None

class RecordList(BaseModel):
    # This will expect the incoming JSON to be an array of the 'Record' objects
    # Pydantic will automatically handle the conversion from a list of dicts.
    # We use a custom root type for this.
    root: List[Record]


# --- 2. Update the Endpoint to Use the Pydantic Model ---

@app.post("/update_data")
async def update_data(new_records: List[Record]):
    """
    Receives a list of new records and appends them
    to the global pandas DataFrame.
    """
    global df

    if not new_records:
        return {"status": "no data", "message": "No new records were provided."}

    # 1. Convert the Pydantic models directly to a list of dicts
    #    This is cleaner and safer than manual processing.
    records_to_add = [
        {
            "patientUid": record.patientUid,
            "userText": record.userText,
            "followUps?": record.followUps,
            # Convert Firestore's millisecond timestamp to seconds
            "createdAt": record.createdAt / 1000
        } 
        for record in new_records
    ]

    # 2. Create a temporary DataFrame from the new list of records
    new_df = pd.DataFrame(records_to_add)

    # 3. Concatenate the global DataFrame with the new one
    df = pd.concat([df, new_df], ignore_index=True)

    # 4. Remove any duplicate entries
    df.drop_duplicates(subset=['patientUid', 'createdAt'], keep='last', inplace=True)

    print(f"DataFrame successfully updated. Total records now: {len(df)}")
    return {"status": "success", "new_records_added": len(new_df)}

# -------------------------------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))  # Get port from environment or use 8080 as default
    uvicorn.run(app, host="0.0.0.0", port=port)