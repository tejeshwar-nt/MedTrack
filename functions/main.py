from fastapi import FastAPI, File, UploadFile
from firebase_functions import https_fn
import whisper
import shutil
import os

app = FastAPI()

@app.on_event("startup")
def load_transcript_model():
    global model
    model = whisper.load_model("base.en")

@app.get("/")
def read_root():
    return {"Hello": "World"}

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

# This is the key part: Expose your FastAPI app as a Firebase Cloud Function
@https_fn.on_request()
def my_api(req: https_fn.Request) -> https_fn.Response:
    # This line routes the incoming Firebase request to your FastAPI app
    return app(req.environ, lambda status, headers: None)