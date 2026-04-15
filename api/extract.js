export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { mediaType, data } = req.body;
    if (!data || !mediaType) {
      return res.status(400).json({ error: 'Missing file data' });
    }

    const isPdf = mediaType === 'application/pdf';
    const sourceBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data } };

    const prompt = `Analizza questo consuntivo di noleggio gruppo elettrogeno ed estrai SOLO i seguenti dati in formato JSON puro (senza markdown, senza testo aggiuntivo):

{
  "kva": <numero, la potenza del GE in kVA>,
  "inizio_noleggio": "<YYYY-MM-DD HH:MM:SS oppure null se non presente>",
  "fine_noleggio": "<YYYY-MM-DD HH:MM:SS oppure null se non presente>",
  "lxx103": <numero, valore della colonna LXX103 o 0 se assente>,
  "lxx107": <numero, valore della colonna LXX107 o 0 se assente>,
  "lxx108": <numero, valore della colonna LXX108 o 0 se assente>,
  "lxx109": <numero, valore della colonna LXX109, prendi solo il primo numero della cella, o 0 se assente>,
  "lxx110": <numero, valore della colonna LXX110, prendi solo il primo numero della cella, o 0 se assente>,
  "lxx101": <numero, valore della colonna LXX101 o 0 se assente>
}

Importante: se nel documento non sono presenti "Inizio Noleggio" e "Fine Noleggio" (cioè non c'è stata installazione), restituisci null per quei due campi. Se una colonna LXX non è presente nella tabella, usa 0. Rispondi SOLO con il JSON, senza altro testo.`;

    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: [sourceBlock, { type: 'text', text: prompt }] }]
      })
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      return res.status(500).json({ error: 'Anthropic API error: ' + errText });
    }

    const apiData = await apiResponse.json();
    let text = apiData.content.map(b => b.text || '').join('').trim();
    text = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
