followup_questions_prompt = """
You are a medical assistant. 

Use the following information:
- Patient record: {record}

Your tasks are:
If uncertainty is high, propose 2–3 brief follow-up questions that would clarify the case.

Format your answer as:
{{
  "followup_questions": ["<question 1>", "<question 2>", "<question 3>"]
}}


"""

example_patient_prompt = """
You are a patient. 

Use the following information:
- Patient record: {record}
- Follow-up questions: {followup_questions}

Your tasks are:
Based on patient record, provide a reasonable answer for follow-up questions.

Format your answer as:
{{
  "followup_answers":[{{"question": <question1>,"answer": <answer1>}}, ...]
}}

"""

general_summary_prompt = """
You are a medical assistant. Analyze the patient’s records and follow-up answers carefully.

Input:
- Patient records: {records}
- Recorded dates: {dates}
- Follow-up answers: {followup_answers}

Your tasks:
1. Summarize the patient’s case in concise terms:
   - Key symptoms in one or two words
   - Onset (number of days)
   - Overall severity (mild, moderate, severe; note if worsening, improving, intermittent)
   - Relevant body parts or systems
2. Flag the importance of each symptom as HIGH / MEDIUM / LOW.
3. Provide a symptom intensity score (0–100) for each symptom with brief reasoning. 
    - Ensure that the score list is in the same length with the records.
    - 0 means it doesn't need immediate care, 100 means it needs urgent care.
4. Suggest 2–3 possible conditions consistent with the symptoms.
5. Indicate whether the patient should see a doctor immediately (Yes / No).
6. Identify significant indicators: exact words or phrases from the patient record that support your reasoning (keep them short).

Format your answer as:
{{
    "summary": {{
        "symptom": [Symptom 1, Symptom 2, ...],
        "severity": "(Severe/Moderate/Mild), (Worsening/Improving/Intermittent)",
        "relevant": Repository/Dermatologistic/...
        }},
    "importance":{{
        "<symptom1>":{{
            "flag":(HIGH / MEDIUM / LOW),
            "score": [day1_intensity_score, day2_intensity_score, ...],
            "reasoning": reasoning
        }},
        ...
    }},
    "possible_conditions": [
        {{"condition": "<name>", "reason": "<reason>"}},
        {{"condition": "<name>", "reason": "<reason>"}}
    ],
    "urgent": (Yes/No),
    "indicator": [indicator1, indicator2, ...]
}}

"""

image_prompt = "Analyze this image and describe the skin condition visible, focusing on redness. Don't supply any potential diagnosis, just the notable features observed. Keep it in under 10"