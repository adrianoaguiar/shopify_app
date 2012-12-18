Zendesk App for Shopify
===============

A new Zendesk App for Shopify

## Features

- When viewing a ticket in Zendesk, the Shopify app displays customer details in the App panel on the right side of your screen.
- If a custom field for order numbers has been setup and filled out, then order information is also displayed.

## Prerequisites
- You must have new Zendesk enabled and accessible through http://{subdomain}.zendesk.com/agent/.

## Install the Shopify app

1. **Login to the [new Zendesk](https://support.zendesk.com/entries/21926757-the-new-zendesk-faqs)**
  
  Navigate to http://{subdomain}.zendesk.com/agent/.


2. **Browse to the Manage page**
  
  Navigate to the manage page by clicking the **Manage** icon.


3. **Create a new app**
  
  Create a new app by selecting Create from the left navigation, then click Create a new app on the right.


4. **Upload the app**
  
  Fill in the name and description fields, upload the [.zip file attached](https://github.com/zendesk/shopify_app/archive/master.zip), then click Save.


5. **Install the app**
  
  Click **Browse** from the left navigation, then hover over the Shopify app and click **Install**.


6. **Configure the app**
  
  Next you'll need to tell the app which Shopify store to connect with and provide authentication details.

  **Title:** This will display above the app in the sidebar.

  **Store URL:** The URL of your Shopify store.

  **API Key:** The API key for your app. 

  **Password:** The Password for your app.  

  See [Private applications](http://wiki.shopify.com/Private_apps#Setup) for instructions on obtaining an API Key and Password.

  **Order ID Field ID:** If you would like to have specific order information displayed in the app, you can supply the Zendesk ticket field ID. If you don't have this information yet you can leave it blank and update the app settings later.

  Once you are finished, simply click Install.

## Customer data right next to your support tickets

Now that you have installed the Shopify app, when you navigate to a support ticket using the new Zendesk you'll be able to see customer and order information.

1. **Navigate to a ticket**
  
  Open a ticket from a customer who already exists in your Shopify store. The Shopify app matches users based on their email address.

2. **Display the app sidebar**
  
  If you haven't had the apps sidebar open before, you'll need to click the **Apps** button.

3. **Shopify details displayed**
  
  Your customer's details and specific order details (if an order ID field is configured) should be displayed.

## Download the Shopify App

[Click here to download](https://github.com/zendesk/shopify_app/archive/master.zip)  

## Known Issues

- Test orders created from test shops in a partner's account are not counted or summed to the total spent value  
