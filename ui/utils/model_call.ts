export async function model_call(dataUrl: string): Promise<string> {
 	console.log("CALLING MODEL")
	const api_link = "http://127.0.0.1:8000/solve";

    const res = await fetch(api_link, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            dataURL: dataUrl,  
        }),
    });

    const data = await res.json();
   
    return data.value;
}
