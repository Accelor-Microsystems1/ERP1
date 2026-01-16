import React from "react";
import { Button } from "antd";
import { UpOutlined, DownOutlined } from "@ant-design/icons";

// Scroll handler component to be added to DirectPoReviewPage.jsx
const ScrollHandler = () => {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  };

  return (
    <div className="fixed right-4 bottom-4 flex flex-col gap-2 z-50">
      <Button
        type="primary"
        shape="circle"
        icon={<UpOutlined />}
        onClick={scrollToTop}
        className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
        size="large"
      />
      <Button
        type="primary"
        shape="circle"
        icon={<DownOutlined />}
        onClick={scrollToBottom}
        className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
        size="large"
      />
    </div>
  );
};

export default ScrollHandler;