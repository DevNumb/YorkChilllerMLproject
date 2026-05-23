
const API_BASE_URL = 'https://DevNumb-randomforestmodel.hf.space/gradio_api/call/predict';

async function testAPI(features, label) {
  console.log(`Testing ${label}...`);
  try {
    const postResponse = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: features })
    });
    const postData = await postResponse.json();
    const { event_id } = postData;
    await new Promise(r => setTimeout(r, 2000));
    const getResponse = await fetch(`${API_BASE_URL}/${event_id}`);
    const text = await getResponse.text();
    const dataMatch = text.match(/data:\s*\["([^"]+)"\]/);
    console.log(`${label} Result:`, dataMatch ? dataMatch[1] : 'No match');
  } catch (e) {
    console.error(`${label} failed:`, e.message);
  }
}

async function runTests() {
  await testAPI([70, 55, 14, 3, 7, 1, 1, 1, 80, 80, 80, 60, 60, 60, 280, 280, 280, 1200], 'Scenario 70F/1200T');
  await testAPI([95, 75, 14, 3, 7, 1, 1, 1, 80, 80, 80, 60, 60, 60, 280, 280, 280, 1200], 'Scenario 95F/1200T');
  await testAPI([85, 65, 14, 3, 7, 1, 1, 1, 80, 80, 80, 60, 60, 60, 280, 280, 280, 500], 'Scenario 85F/500T');
  await testAPI([85, 65, 14, 3, 7, 1, 1, 1, 80, 80, 80, 60, 60, 60, 280, 280, 280, 2000], 'Scenario 85F/2000T');
}

runTests();
