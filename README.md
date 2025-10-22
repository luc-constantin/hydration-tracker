# Hydration Tracker PWA

A simple Progressive Web App (PWA) that helps you track daily water intake.  
You can install it directly on your iPhone home screen and log water into the Health app using the iOS Shortcuts app.

---

## 📍 Live Demo

[👉 Install the app here](https://luc-constantin.github.io/hydration-tracker/)

---

## How to Install on iPhone (iOS 18)

1. Open the [app link](https://luc-constantin.github.io/hydration-tracker/) in Safari.  
2. Tap the **Share** icon in the bottom bar.  
3. Choose **“Add to Home Screen.”**  
4. Tap **Add**.  
5. The Hydration Tracker will now appear on your Home Screen as an app.

---

## How to Create the LogWater Shortcut (iOS 18)

This shortcut allows the app to automatically log your water intake into the Health app when you press the buttons (+250 ml, +300 ml, etc.).

### Steps:

1. Open the **Shortcuts** app on your iPhone.  
2. Tap **“+”** to create a new shortcut.  
3. Name it **LogWater** (exactly like this).  
4. Add the action **Log Health Sample**.  
5. Set:
   - **Type** → Water  
   - **Value** → Shortcut Input  
   - **Unit** → mL  
   - **Date** → Current Date
6. Add **Stop and Output** → Health Sample.  
7. Tap **Done** to save.

Your shortcut should look similar to the image below:

![LogWater Shortcut Example](./IMG_2599.jpg)

---

## Development

To run locally:

```bash
git clone https://github.com/luc-constantin/hydration-tracker.git
cd hydration-tracker
