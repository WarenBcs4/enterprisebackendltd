const axios = require('axios');

// WhatsApp Business API integration
class WhatsAppService {
  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v17.0';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  }

  async sendPayslip(phoneNumber, employeeName, payslipBuffer, fileName) {
    try {
      // Clean phone number (remove spaces, dashes, etc.)
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // Upload document first
      const uploadResponse = await this.uploadDocument(payslipBuffer, fileName);
      
      if (!uploadResponse.success) {
        throw new Error('Failed to upload payslip document');
      }

      // Send document message
      const messageData = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'document',
        document: {
          id: uploadResponse.mediaId,
          caption: `Hi ${employeeName}, your payslip for this period is attached. Please keep this for your records.`,
          filename: fileName
        }
      };

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        messageData,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id,
        phone: cleanPhone
      };
    } catch (error) {
      console.error('WhatsApp send error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  async uploadDocument(buffer, fileName) {
    try {
      const FormData = require('form-data');
      const form = new FormData();
      
      form.append('messaging_product', 'whatsapp');
      form.append('file', buffer, {
        filename: fileName,
        contentType: 'application/pdf'
      });
      form.append('type', 'application/pdf');

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/media`,
        form,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            ...form.getHeaders()
          }
        }
      );

      return {
        success: true,
        mediaId: response.data.id
      };
    } catch (error) {
      console.error('WhatsApp upload error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  async sendTextMessage(phoneNumber, message) {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      const messageData = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        messageData,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }
}

module.exports = new WhatsAppService();