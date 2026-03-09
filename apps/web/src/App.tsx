import { useEffect, useState } from "react";

export default function App() {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    fetch("/api/health")
      .then(r => r.json())
      .then(data => {
        if (typeof data.status === "string") {
          setStatus(data.status);
          return;
        }
        setStatus(data.ok ? "ok" : "error");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div>
      <h1>Tedography</h1>
      <p>API status: {status}</p>
    </div>
  );
}
