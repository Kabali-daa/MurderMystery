import { useEffect } from "react";
const ScriptLoader = () => {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/papaparse@5.3.2/papaparse.min.js";
    script.async = true;
    document.body.appendChild(script);

    const fonts = document.createElement("link");
    fonts.href = "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Playfair+Display:wght@700&family=Special+Elite&display=swap";
    fonts.rel = "stylesheet";
    document.head.appendChild(fonts);

    const styles = document.createElement("style");
    styles.innerHTML = `
      @keyframes fade-in-out {
        0% { opacity: 0; transform: translateY(-20px); }
        10% { opacity: 1; transform: translateY(0); }
        90% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-20px); }
      }
      .animate-fade-in-out {
        animation: fade-in-out 5s ease-in-out forwards;
      }
    `;
    document.head.appendChild(styles);

    return () => {
      document.body.removeChild(script);
      document.head.removeChild(fonts);
      document.head.removeChild(styles);
    };
  }, []);
  return null;
};
export default ScriptLoader;