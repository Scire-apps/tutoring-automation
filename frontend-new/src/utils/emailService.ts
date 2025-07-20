// Simple email service using EmailJS (free tier)
// For production, you'd want to use a proper email service

interface EmailResult {
  success: boolean;
  error?: string;
}

export async function sendInvitationEmail(
  toEmail: string, 
  role: string, 
  registrationUrl: string
): Promise<EmailResult> {
  try {
    // For now, we'll use a simple fetch to a free email service
    // In production, you'd use EmailJS, SendGrid, or similar
    
    // Since we don't have a real email service set up, let's simulate it
    // and provide the user with the registration URL
    
    console.log('Sending invitation email to:', toEmail);
    console.log('Role:', role);
    console.log('Registration URL:', registrationUrl);
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For now, we'll copy the URL to clipboard if possible
    try {
      await navigator.clipboard.writeText(registrationUrl);
      return {
        success: true,
        error: undefined
      };
    } catch (clipboardError) {
      return {
        success: false,
        error: 'Could not copy URL to clipboard. Please copy manually.'
      };
    }
    
  } catch (error) {
    console.error('Email service error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Alternative: Use a simple webhook service like Zapier or Make.com
export async function sendInvitationEmailViaWebhook(
  toEmail: string,
  role: string,
  registrationUrl: string
): Promise<EmailResult> {
  try {
    // You can set up a webhook on Zapier/Make.com that sends emails
    // const webhookUrl = 'YOUR_WEBHOOK_URL_HERE';
    
    const emailData = {
      to: toEmail,
      subject: `Invitation to join as ${role}`,
      body: `
You have been invited to join the Tutoring System as a ${role}.

Please click the following link to complete your registration:
${registrationUrl}

This invitation will expire in 7 days.

If you did not expect this invitation, please ignore this email.
      `
    };
    
    // Uncomment and configure when you have a webhook URL
    /*
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });
    
    if (response.ok) {
      return { success: true };
    } else {
      return { success: false, error: 'Webhook failed' };
    }
    */
    
    // For now, just log the email data
    console.log('Email data that would be sent:', emailData);
    return { success: false, error: 'Webhook not configured' };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Webhook error'
    };
  }
}