# Hydration Tracker PWA

Hydration Tracker is a simple Progressive Web App (PWA) designed to help you log your daily water intake.  
It can be installed on iPhone as a PWA and integrated with the Apple Health app through a custom iOS Shortcut.

---

## Live App

[https://luc-constantin.github.io/hydration-tracker/](https://luc-constantin.github.io/hydration-tracker/)

---

## 1. How to Install on iPhone (iOS 18)

1. Open the link above in Safari on your iPhone.  
2. Tap the **Share** icon at the bottom of the screen.  
3. Choose **Add to Home Screen**.  
4. Tap **Add**.  
5. The app will appear on your iPhone home screen like a native app.

---

## 2. How to Create the “LogWater” Shortcut (iOS 18)

This shortcut allows the app to send water intake values directly to Apple Health.

### Steps:
1. Open the **Shortcuts** app.  
2. Tap the **“+”** button to create a new shortcut.  
3. Name the shortcut exactly: **LogWater**.  
4. Add the action **Log Health Sample**.  
   - Type: `Water`  
   - Value: `Shortcut Input`  
   - Unit: `mL`  
   - Date: `Current Date`  
5. Add the action **Stop and Output** and set output to **Health Sample**.  
6. Save the shortcut by tapping **Done**.

Your shortcut should look like this:

![LogWater Shortcut Example](./IMG_2599.jpg)

---

## 3. Development Setup

Clone and run the project locally:

```bash
git clone https://github.com/luc-constantin/hydration-tracker.git
cd hydration-tracker
