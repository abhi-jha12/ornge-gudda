class NotificationService {
  constructor() {
    this.notificationUrl = 'https://ornge.site/notification-service/api/send-notification';
  }

  async sendNotification(clientId, title, body) {
    try {
      const response = await fetch(this.notificationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          title,
          body
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to send notification:', error);
      throw error;
    }
  }
}
module.exports = NotificationService;