from fastapi import FastAPI, File, UploadFile
from fastapi.responses import Response
import whisper
import uvicorn
import shutil
import os
import io
import base64
import json

import prompts
import example_queries
import matplotlib.pyplot as plt
import numpy as np

sample_query = example_queries.dermatological_example

from openai import OpenAI

from tmp import api_key
OPENAI_KEY = api_key.KEY

model_type = "gpt-4o-mini"
token_limit = 500
image_prompt = "Analyze this image and describe the skin condition visible, focusing on redness. Don't supply any potential diagnosis, just the notable features observed."

app = FastAPI()

# ------------------------------------------------------------------------

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.on_event("startup")
def load_transcript_model():
    global model
    model = whisper.load_model("base.en")

@app.on_event("startup")
def connect_to_openai():
	global openai_client
	openai_client = OpenAI(api_key=OPENAI_KEY)

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
					{"type": "text", "text": image_prompt},
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
	prompt_1 = prompts.prompt_template_1.format(record=records)

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
async def followup_question_generator(records: str) -> list[str]:
	return await _followup_question_generator(records)

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

# ------------------------------------------------------------------------

async def _summarize_records(records: str, followup_and_response: dict) -> dict:
	prompt_2 = prompts.prompt_template_2.format(record=records, followup_answers = followup_and_response)

	messages = [
		{"role": "user", "content": prompt_2}
	]

	response = await query_llm(messages, temperature=0.3)

	# print(response.choices[0].message.content)

	content2 = response.choices[0].message.content
	data2 = json.loads(content2)

	return data2

@app.post("/summarize")
async def summarize_records(records: str, followup_and_response: dict) -> dict:
	return await _summarize_records(records, followup_and_response)

# ------------------------------------------------------------------------

@app.get("/test_record_assistant")
async def test_record_assistant():
	followup_questions = await _followup_question_generator(sample_query)
	question_response = await _patient_sample_response(sample_query, followup_questions)
	return await _summarize_records(sample_query, question_response)

# ------------------------------------------------------------------------

@app.post("/plot_summary")
def plot_summary(summarized: dict):
	importance_data = summarized['importance']

	symptom_list = list(importance_data.keys())
	score_list = []
	for symptom in symptom_list:
		score_list.append(importance_data[symptom]['score'])

	# print(symptom_list,score_list)

	num_days = len(score_list[0])

	# Convert to numpy array for easy stacking
	logs = []
	for i in range(num_days):
		logs.append(f'Day {i+1}')

	scores_arr = np.array(score_list).T  # shape: (num_symptoms, num_days)
	# print(scores_arr.shape)

	# Colors for each category
	colors = ["#a6cee3",  # light blue
				"#fdbf6f",  # soft orange
				"#b2df8a",  # light green
				"#fb9a99",  # soft red/pink
				"#cab2d6",  # light purple
				"#ffff99"]  # pale yellow

	# Plot stacked bars
	plt.figure(figsize=(10,3))
	bottom = np.zeros(num_days)  # initialize bottom positions

	for i in range(len(symptom_list)):
		plt.bar(logs, scores_arr[:, i], bottom=bottom, color=colors[i], label=symptom_list[i])
		bottom += scores_arr[:,i]  # update bottom for next layer

	plt.ylabel("Score")
	plt.title("Stacked Symptom Scores")
	plt.legend()
	
	buffer = io.BytesIO()
	plt.savefig(buffer, format="png")
	plt.close()

	# Rewind the buffer's cursor to the beginning
	buffer.seek(0)

	return Response(content=buffer.getvalue(), media_type="image/png")

@app.get("/test_plot")
async def test_plot():
	summarized = await test_record_assistant()
	return plot_summary(summarized)

# ------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))  # Get port from environment or use 8080 as default
    uvicorn.run(app, host="0.0.0.0", port=port)