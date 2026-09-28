// A standalone status pill component for color-coding status
export default function StatusPill({ status }) {
  let colorClass = "";
  let text = status || "New";
  switch ((status || "").toLowerCase()) {
    case "approved":
      colorClass = "bg-green-100 text-green-700";
      text = "Approved";
      break;
    case "pending":
      colorClass = "bg-yellow-100 text-yellow-700";
      text = "Pending";
      break;
    case "rejected":
      colorClass = "bg-red-100 text-red-700";
      text = "Rejected";
      break;
    case "in review":
      colorClass = "bg-blue-100 text-blue-700";
      text = "In Review";
      break;
    case "new":
    default:
      colorClass = "bg-gray-100 text-gray-700";
      text = "New";
      break;
  }
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
      {text}
    </span>
  );
}