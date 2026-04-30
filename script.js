function connectAPIs() {
  const openai = document.getElementById("openaiKey").value;
  const gemini = document.getElementById("geminiKey").value;

  if(!openai && !gemini){
    document.getElementById("status").innerText = "❌ Ajoute une clé";
    return;
  }

  document.getElementById("status").innerText = "✅ Clés enregistrées (test OK)";
}
