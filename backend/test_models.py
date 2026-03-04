"""Quick test to see which free OpenRouter models are actually available.
Run from the backend venv: python test_models.py
Then update LLM_MODEL in graph.py to the best working one."""

from dotenv import load_dotenv
load_dotenv(".env")
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

models = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwq-32b:free",
    "qwen/qwen3-4b:free",
    "deepseek/deepseek-r1-0528-qwen3-8b:free",
    "deepseek/deepseek-r1-distill-qwen-32b:free",
    "liquid/lfm-2.5-1.2b-thinking:free",
]

for m in models:
    try:
        r = client.chat.completions.create(
            model=m,
            messages=[{"role": "user", "content": "Reply with just the number 42"}],
            max_tokens=10,
        )
        print(f"OK   : {m} -> {r.choices[0].message.content.strip()[:40]}")
    except Exception as e:
        print(f"FAIL : {m} -> {str(e)[:100]}")
