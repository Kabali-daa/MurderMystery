import React from "react";
const Modal = ({ message, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="bg-zinc-900 p-6 rounded-lg shadow-xl max-w-sm w-full text-center border border-zinc-700">
      <p className="text-zinc-100 text-lg mb-6">{message}</p>
      <button
        onClick={onClose}
        className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
      >
        OK
      </button>
    </div>
  </div>
);
export default Modal;