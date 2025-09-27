from fastapi import FastAPI, File, UploadFile
import whisper
import uvicorn
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

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))  # Get port from environment or use 8080 as default
    uvicorn.run(app, host="0.0.0.0", port=port)