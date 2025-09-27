prompt_template_1 = """
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
  <question1>: <answer1>,
  <question2>: <answer2>, 
  ...
}}

"""


prompt_template_2 = """
You are a medical assistant. 

Use the following information:
- Patient record: {record}
- Follow-up answers: {followup_answers}

Your tasks are:
1. Based on patient record and follow-up answers, summarize the patient’s case in short words (key symptoms, onset, severity, body parts/systems).
2. Flag the importance/intensity of symptoms (HIGH / MEDIUM / LOW) and score daily intensity from 0 to 100 with a brief reasoning.
3. Suggest 2–3 possible conditions. 
4. Indicate if the patient should see a doctor immediately ("Yes" or "No")
5. Find the significant indicators (with exact words from the patient record) that leads to all the reasoning. This should be a short phrase.

Format your answer as following example:
Summary:
- Main symptoms: Symptom 1, Symptom 2, ...
- Onset: N Days
- Severity: (Severe/Moderate/Mild), (Worsening/Improving/Intermittent)
- Relevant: Repository

Importance:
- Symptom 1 → (HIGH / MEDIUM / LOW), [day1_intensity_score, day2_intensity_score, ...]
- Symptom 2 → (HIGH / MEDIUM / LOW), [day1_intensity_score, day2_intensity_score, ...]
- Symptom 3 → (HIGH / MEDIUM / LOW), [day1_intensity_score, day2_intensity_score, ...]
- Symptom 4 → (HIGH / MEDIUM / LOW), [day1_intensity_score, day2_intensity_score, ...]
Possible Conditions:

Urgent Recommendations: (Yes/No)

Significant Indicators:

Format your answer as:
{{
    "summary": {{
        "symptom": [Symptom 1, Symptom 2, ...],
        "onset": "N days",
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