import React from "react";
const ConfirmationModal = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="bg-zinc-900 p-6 rounded-lg shadow-xl max-w-sm w-full text-center border border-zinc-700">
      <p className="text-zinc-100 text-lg mb-6">{message}</p>
      <div className="flex justify-center space-x-4">
        <button
          onClick={onConfirm}
          className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold py-2 px-6 rounded-lg transition duration-300 ease-in-out shadow-md"
        >
          Confirm
        </button>
        <button
          onClick={onCancel}
          className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-6 rounded-lg transition duration-300 ease-in-out shadow-md"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
);
export default ConfirmationModal;