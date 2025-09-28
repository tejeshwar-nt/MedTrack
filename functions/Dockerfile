# Use a lightweight official Python image as the base
FROM python:3.11-slim

# Install system dependencies (like ffmpeg) first
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install the Python dependencies listed in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy all the rest of your local files into the container
COPY . .

# Expose the port that your application will run on
ENV PORT 8080
EXPOSE 8080

# Command to run your application using Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]