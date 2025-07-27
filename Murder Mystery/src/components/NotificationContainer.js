import React from "react";
const NotificationContainer = ({ notifications }) => (
  <div className="fixed top-5 right-5 z-[100] w-full max-w-xs">
    <div className="flex flex-col-reverse gap-2">
      {notifications.map(n => (
        <div key={n.id} className="bg-green-600/90 text-white p-3 rounded-lg shadow-lg animate-fade-in-out">
          {n.message}
        </div>
      ))}
    </div>
  </div>
);
export default NotificationContainer;