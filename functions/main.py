from fastapi import FastAPI, File, UploadFile
import uvicorn
import shutil
import os
import base64

OPEN_AI_KEY_NAME = "Sample Key"

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

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

		# Return the transcribed text
		return {"transcription": encoded}
	finally:
		if os.path.exists(temp_file_path):
			os.remove(temp_file_path)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))  # Get port from environment or use 8080 as default
    uvicorn.run(app, host="0.0.0.0", port=port)