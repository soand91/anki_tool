export async function ankiCall(body: unknown) {
  try {
    const res = await fetch('http://127.0.0.1:8765', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    return { error: (err as Error).message };
  }
}