# Use a lightweight official Python image as the base
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file into the container at /app
# This step is crucial for Docker's build cache. If requirements.txt doesn't change,
# Docker won't re-run the `pip install` command, speeding up subsequent builds.
COPY requirements.txt .

# Install the dependencies listed in requirements.txt
# The --no-cache-dir flag helps keep the image size small
RUN pip install --no-cache-dir -r requirements.txt

# Copy all the rest of your local files into the container
# This includes main.py and any other necessary files
COPY . .

# Expose the port that your application will run on
# This is for documentation purposes and helps other services know which port to connect to
EXPOSE 8080

# Command to run your application using Uvicorn
# The command should reference the Python file and the FastAPI app object
# `--host 0.0.0.0` is essential to make the application accessible outside the container
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]