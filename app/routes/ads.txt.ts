export const loader = async () => {
  const content = 'google.com, pub-7586045516328295, DIRECT, f08c47fec0942fa0'
  
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      encoding: 'UTF-8'
    }
  })
}
