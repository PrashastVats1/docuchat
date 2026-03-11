import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

#Initialise the Open AI cient once here, resuse for all requests
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """You are DocuChat, a helpful AI assistant.
You answer questions clearly and concisely.
If you are given document context, base your answers on that context.
If the answer is not in the context, say so honestly."""

def chat(user_message: str, context: str = "") -> str:
    """
    Send a message to OpenAI and return the response text.
    - user message: what the user typed
    - context: optional document text to ground the answer
    """
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
    ]

    #If we have document context, inject it before user's question
    if context:
        messages.append({
            "role": "user",
            "content": f"Here is the document context:\n\n{context}"
        })
        messages.append({
            "role": "assistant",
            "content": "I have read the document. Please ask your question."
        })
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model="gpt-4o-mini",       # cheap, fast, very capable
        messages=messages,
        max_tokens=1000,
        temperature=0.3,           # lower = more factual, less creative
    )
    return response.choices[0].message.content