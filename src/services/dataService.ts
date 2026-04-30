export const getStatusData = async () => {
  try {
    const response = await fetch('/core-api/status', { 
      cache: 'no-store',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.status === 429) {
      const error = new Error("Rate limit exceeded (429)");
      (error as any).status = 429;
      throw error;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      // Log the actual body for debugging if it's not JSON
      const text = await response.text();
      console.error("Non-JSON response body:", text.slice(0, 200));
      throw new Error("Received non-JSON response from server");
    }
    
    return await response.json();
  } catch (error) {
    if ((error as any).status !== 429) {
      console.error("Error fetching status data:", error);
    }
    throw error;
  }
};
