export function formatCountdown(targetDate: Date): string {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    return "Available now";
  }

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (totalHours < 1) {
    return `${totalMinutes} ${totalMinutes === 1 ? "minute" : "minutes"}`;
  }

  if (totalDays < 1) {
    const hours = totalHours;
    const minutes = totalMinutes % 60;
    if (minutes === 0) {
      return `${hours} ${hours === 1 ? "hour" : "hours"}`;
    }
    return `${hours} ${hours === 1 ? "hour" : "hours"}, ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }

  const days = totalDays;
  const hours = totalHours % 24;
  if (hours === 0) {
    return `${days} ${days === 1 ? "day" : "days"}`;
  }
  return `${days} ${days === 1 ? "day" : "days"}, ${hours} ${hours === 1 ? "hour" : "hours"}`;
}
