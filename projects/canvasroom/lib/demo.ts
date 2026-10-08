import type { Board } from "./canvas";
export const demoBoard: Board = {
  name: "Courier checkout map",
  shapes: [
    { id: "brief", kind: "note", x: 96, y: 100, width: 190, height: 126, label: "Design a checkout that feels calm, fast and trustworthy.", fill: "#ffca5c" },
    { id: "cart", kind: "rectangle", x: 384, y: 86, width: 188, height: 82, label: "Cart review", fill: "#f7f5ef" },
    { id: "address", kind: "rectangle", x: 384, y: 240, width: 188, height: 82, label: "Delivery details", fill: "#7b8cff" },
    { id: "pay", kind: "ellipse", x: 675, y: 222, width: 190, height: 106, label: "M-PESA payment", fill: "#55d6be" },
    { id: "success", kind: "rectangle", x: 960, y: 235, width: 190, height: 82, label: "Order confirmed", fill: "#ff7a59" },
    { id: "metric", kind: "text", x: 690, y: 80, width: 245, height: 55, label: "Target: checkout in under 60 sec", fill: "#f7f5ef" },
  ],
  connections: [
    { id: "c1", from: "brief", to: "cart", label: "frames" },
    { id: "c2", from: "cart", to: "address", label: "continue" },
    { id: "c3", from: "address", to: "pay", label: "validate" },
    { id: "c4", from: "pay", to: "success", label: "receipt" },
  ],
  comments: [
    { id: "comment-1", x: 886, y: 330, text: "Show the delivery window before payment.", author: "Product", resolved: false, createdAt: 1791432000000 },
    { id: "comment-2", x: 595, y: 205, text: "Address validation copy approved.", author: "Design", resolved: true, createdAt: 1791435600000 },
  ],
};
