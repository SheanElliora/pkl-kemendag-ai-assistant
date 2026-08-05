import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import "@fontsource/inter";

const style = document.createElement("style");

style.innerHTML = `
html, body, #root {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
`;

document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
