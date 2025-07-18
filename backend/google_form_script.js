/**
 * Google Apps Script to send form responses to our backend
 *
 * IMPORTANT: This script is NOT ready to use as-is. You need to:
 *
 * 1. Deploy your backend application to get a public URL
 * 2. Update the WEBHOOK_URL below with your actual backend URL
 * 3. Generate a secure random string for WEBHOOK_SECRET
 * 4. Update the WEBHOOK_SECRET in your backend .env file to match
 *
 * Instructions for deployment:
 * 1. Open your Google Form
 * 2. Click on the three dots in the top right corner and select "Script editor"
 * 3. Copy and paste this script
 * 4. Replace the configuration values below
 * 5. Save and deploy as a web app
 * 6. Set up a trigger to run this function on form submit
 */

// Configuration - UPDATE WEBHOOK_URL with your deployed backend URL
const WEBHOOK_URL = "http://localhost:8002/api/webhook/google-forms"; // UPDATE THIS FOR PRODUCTION
const WEBHOOK_SECRET = "tutoring_webhook_secret_2024";
// Must match GOOGLE_FORMS_WEBHOOK_SECRET in backend .env

/**
 * This function runs when the form is submitted
 */
function onFormSubmit(e) {
  try {
    // Get form response
    const formResponse = e.response;
    const itemResponses = formResponse.getItemResponses();
    const timestamp = formResponse.getTimestamp();
    const form = formResponse.getEditResponseUrl().split("/")[5]; // Extract form ID
    const formTitle = FormApp.openById(form).getTitle();

    // Format data
    const responses = [];

    itemResponses.forEach(function (itemResponse) {
      const question = itemResponse.getItem().getTitle();
      const answer = itemResponse.getResponse();

      responses.push({
        questionTitle: question,
        answer: answer,
      });
    });

    // Prepare payload
    const payload = {
      formId: form,
      formTitle: formTitle,
      timestamp: timestamp.toISOString(),
      responses: responses,
    };

    // Send to webhook
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      headers: {
        "X-Webhook-Secret": WEBHOOK_SECRET,
      },
      muteHttpExceptions: true,
    };

    // Send the HTTP request
    const response = UrlFetchApp.fetch(WEBHOOK_URL, options);

    // Log the result
    Logger.log("Webhook response: " + response.getContentText());
    Logger.log("Status code: " + response.getResponseCode());

    return response.getResponseCode() === 201; // 201 Created
  } catch (error) {
    Logger.log("Error: " + error.toString());
    return false;
  }
}

/**
 * Test function to verify the script works
 */
function testWebhook() {
  // Create a mock form response
  const mockPayload = {
    formId: "test-form-id",
    formTitle: "Tutoring Request Form",
    timestamp: new Date().toISOString(),
    responses: [
      { questionTitle: "Full Name", answer: "John Doe" },
      { questionTitle: "Email Address", answer: "john.doe@example.com" },
      { questionTitle: "Subject", answer: "Mathematics" },
      { questionTitle: "Grade Level", answer: "11th Grade" },
      { questionTitle: "School", answer: "Example High School" },
      { questionTitle: "Availability", answer: "Weekdays after 4pm" },
      { questionTitle: "Location Preference", answer: "Online" },
      { questionTitle: "Additional Notes", answer: "Need help with calculus" },
    ],
  };

  // Send to webhook
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(mockPayload),
    headers: {
      "X-Webhook-Secret": WEBHOOK_SECRET,
    },
    muteHttpExceptions: true,
  };

  // Send the HTTP request
  const response = UrlFetchApp.fetch(WEBHOOK_URL, options);

  // Log the result
  Logger.log("Webhook response: " + response.getContentText());
  Logger.log("Status code: " + response.getResponseCode());

  return response.getResponseCode() === 201; // 201 Created
}
