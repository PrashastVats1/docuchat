import os
from openai import OpenAI
from dotenv import load_dotenv
from app.services.prompts import RESUME_SYSTEM_PROMPT

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = RESUME_SYSTEM_PROMPT


def chat(user_message: str, context: str = "", history: list = None) -> str:
    if history is None:
        history = []

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if context:
        messages.append({
            "role": "user",
            "content": f"Here is the document context:\n\n{context}"
        })
        messages.append({
            "role": "assistant",
            "content": "I have read the document. Please ask your question."
        })

    # Add last 5 messages of history
    for entry in history[-16:]:
        messages.append({"role": "user", "content": entry["user"]})
        messages.append({"role": "assistant", "content": entry["assistant"]})

    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        max_tokens=1000,
        temperature=0.3,
    )
    return response.choices[0].message.content
