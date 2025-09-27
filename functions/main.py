from fastapi import FastAPI, File, UploadFile
import whisper
import uvicorn
import shutil
import os

from openai import OpenAI

OPENAI_KEY = "YOUR_API_KEY"
model_type = "gpt-4o"
token_limit = 100
image_prompt = "Analyze this image and describe the skin condition visible, focusing on redness. Don't supply any potential diagnosis, just the notable features observed."

app = FastAPI()

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

async def query_llm(messages: list[dict[str, any]], token_limit=token_limit):
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

def encode_image_to_base64(img_path: str):
	try:
		with open(img_path, "rb") as img_file:
			encoded_image = base64.b64encode(img_file.read()).decode("utf-8")
	except FileNotFoundError:
		print(f"Error: Image file not found at {img_path}")
		encoded_image = None
	return encoded_image

@app.post("/transcribe_image")
async def transcribe_image(file: UploadFile = File(...)):
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
		return {"transcription": response.choices[0].message.content}
	finally:
		if os.path.exists(temp_file_path):
			os.remove(temp_file_path)

@app.post("/transcribe_audio")
async def transcribe_audio(file: UploadFile = File(...)):
	temp_file_path = f"temp_{file.filename}"
	try:
		# Save the uploaded file temporarily
		with open(temp_file_path, "wb") as buffer:
			shutil.copyfileobj(file.file, buffer)

		# Transcribe the audio file using Whisper
		result = model.transcribe(f"temp_{file.filename}")

		# Return the transcribed text
		return {"transcription": result["text"]}
	finally:
		if os.path.exists(temp_file_path):
			os.remove(temp_file_path)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))  # Get port from environment or use 8080 as default
    uvicorn.run(app, host="0.0.0.0", port=port)