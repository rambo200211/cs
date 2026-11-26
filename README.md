# 💰 Pocket Ledger

### Offline-First Personal Money Tracker

A React Native mobile application built with **Expo and TypeScript**, designed to help users manage their daily income, expenses, and monthly finances through a simple, modern interface.

Pocket Ledger is designed to work offline, with financial information stored locally on the user's device.

## 📱 Project Overview

**Project Name:** Pocket Ledger
**Repository:** MoneyTracker-SDK58
**Platform:** Android
**Framework:** React Native + Expo
**Expo SDK:** 58
**Language:** TypeScript
**Database:** Expo SQLite
**Architecture:** Offline-first

### Project Goals

- Record and manage daily income and expenses.
- Transfer money between Pocket money and Account without changing income or expense totals.
- Track money borrowed or lent, record repayments, and see outstanding loan balances.
- Record borrowed purchases on credit as expenses without reducing available cash until repayment.
- Organize financial transactions.
- Calculate income, expenses, and remaining balances.
- Provide monthly financial summaries.
- Carry forward remaining balances into the following month.
- Store financial records locally without requiring an internet connection.
- Offer a clean and user-friendly mobile experience.

These are the intended project capabilities. Individual feature completion should be confirmed against the current source code.

---

## 🛠️ Technology Stack

| Technology     | Purpose                              |
| -------------- | ------------------------------------ |
| React Native   | Mobile application development       |
| Expo SDK 58    | Development and native build tooling |
| TypeScript     | Type-safe development                |
| NativeWind     | Tailwind-style UI styling            |
| Expo SQLite    | Local database storage               |
| Expo EAS Build | Android APK generation               |
| Git & GitHub   | Version control and collaboration    |

## 📋 Prerequisites

Before starting development, install:

- Node.js (a version compatible with Expo SDK 58)
- npm
- Git
- Visual Studio Code
- Android Studio and an emulator, or a physical Android device
- An Expo account for EAS builds

Useful links:

- [Node.js](https://nodejs.org/)
- [Git](https://git-scm.com/)
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo EAS Build](https://docs.expo.dev/build/introduction/)

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/MoneyTracker-SDK58.git
```

Replace `YOUR-USERNAME` with the actual repository owner's GitHub username.

### 2. Navigate to the Project

```bash
cd MoneyTracker-SDK58
```

### 3. Install Dependencies

```bash
npm install
```

Use the existing package lockfile to maintain dependency compatibility. For a clean, reproducible installation, `npm ci` can be used when a valid `package-lock.json` is available.

### 4. Verify Expo Dependencies

```bash
npx expo install --check
```

If compatibility issues are reported, review them before changing dependencies.

### 5. Start the Development Server

```bash
npx expo start --clear
```

Depending on the installed native dependencies, run the project through a compatible Expo Go client or an Expo development build.

### 6. Run on Android

When the Android development environment is configured:

```bash
npx expo run:android
```

This command builds and runs the Android application locally.

---

## 📦 Building an Installable Android APK

Pocket Ledger uses Expo Application Services (EAS) for Android builds.

### 1. Log In to Expo

```bash
npx eas-cli login
```

### 2. Configure EAS Build

```bash
npx eas-cli build:configure
```

### 3. APK Build Configuration

The `eas.json` file should contain a preview profile configured to generate an APK.

```json
{
  "cli": {
    "version": ">= 27.11.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

### 4. Generate the APK

```bash
npx eas-cli build --platform android --profile preview
```

To rebuild without using the EAS build cache:

```bash
npx eas-cli build --platform android --profile preview --clear-cache
```

### 5. Install the APK

After a successful build:

1. Open the EAS build page.
2. Download the generated `.apk` file.
3. Transfer it to an Android device if necessary.
4. Open the APK and follow Android's installation prompts.

The preview APK is intended for direct installation and testing. A production Play Store release may require an Android App Bundle (`.aab`) and additional release configuration.

---

## 💾 Local Data Storage

Pocket Ledger is designed to use SQLite for offline financial data storage.

### Intended Data Categories

**Income Records**

- Amount
- Date
- Category or description

**Expense Records**

- Amount
- Date
- Category or description

**Transfers**

- Amount, date, and optional note
- Source and destination payment types
- Transfers update the two payment-type balances but do not count as income or expenses.

**Loans**

- Record who money was borrowed from or lent to, the amount, and the payment type.
- Record repayments and view the remaining amount owed.
- Loan principal and repayments update payment-type balances without changing income or expense totals.
- Borrowed goods or services can be recorded as credit purchases: they increase expenses and outstanding debt, but do not change cash balances until repaid.

**Monthly Summaries**

- Total income
- Total expenses
- Opening balance
- Closing balance
- Carry-forward balance

### Monthly Carry-Forward Logic

The intended balance calculation is:

```text
Closing Balance =
Opening Balance + Total Income - Total Expenses
```

The closing balance of the previous month becomes the opening balance of the next month.

```text
November Closing Balance
           |
           v
December Opening Balance
```

Developers should verify that this calculation is correctly implemented in the application before modifying financial logic.

**Important:** Uninstalling the application or clearing application storage may permanently delete locally stored financial records unless a backup or migration mechanism is implemented.

---

## 🔐 Privacy and Security

Pocket Ledger follows an offline-first design with local device storage.

Development guidelines:

- Do not commit secrets, passwords, or signing keys to GitHub.
- Keep generated build files out of version control.
- Validate financial inputs before storing transactions.
- Use appropriate financial precision and rounding rules.
- Avoid logging sensitive transaction information.
- Verify local data protection before making security guarantees.

SQLite storage alone does not guarantee encryption. Any encryption or additional data-protection mechanisms must be separately implemented and verified.

---

## 🧑‍💻 Developer Handover

This repository is intended to support continued development by other contributors.

### Before Making Changes

1. Read this README.
2. Review `package.json` for actual installed dependencies.
3. Examine the existing application architecture.
4. Inspect the SQLite initialization and database logic.
5. Understand the current financial calculations.
6. Run the application and test the existing functionality.
7. Review open GitHub Issues and recent commits.

### Recommended Development Workflow

Create a new branch:

```bash
git checkout -b feature/feature-name
```

Implement and test changes.

Commit the changes:

```bash
git add .
git commit -m "Add feature description"
```

Push the branch:

```bash
git push -u origin feature/feature-name
```

Open a GitHub Pull Request for review before merging into `main`.

### Development Guidelines

- Follow the existing TypeScript and React Native coding conventions.
- Keep components readable and reusable.
- Avoid unnecessary dependencies.
- Maintain compatibility with the configured Expo SDK.
- Test income, expense, and monthly balance calculations.
- Preserve existing user data when making database schema changes.
- Test Android builds before submitting major changes.
- Update documentation when introducing new features.

---

## 🧪 Testing

Before submitting changes, verify:

- The application starts successfully.
- Income records can be created and displayed.
- Expense records can be created and displayed.
- Financial totals are calculated correctly.
- Data persists after restarting the application.
- Monthly balance calculations are accurate.
- Carry-forward calculations handle month transitions.
- The application behaves correctly without internet access.
- Existing financial records are preserved during normal application updates.

These are recommended tests, not a claim that an automated testing suite is already implemented.

---

## 🐛 Known Build Issue

### Android Gradle Autolinking Path Error

An earlier EAS Android build failed while configuring `react-native-worklets`.

The build log showed a Windows absolute path being interpreted inside the Linux EAS build environment.

Example:

```text
Configuring project ':react-native-worklets'
without an existing directory is not allowed.
```

The generated project directory contained a Windows drive path under the Linux build directory.

Recommended investigation:

1. Inspect the EAS `Run gradlew` build logs.
2. Remove stale local Android generated build files.
3. Verify `.gitignore` and `.easignore` exclusions.
4. Review React Native autolinking and generated Android configuration.
5. Retry the build with `--clear-cache` after correcting the underlying configuration.

**Status:** Resolution and successful APK generation have not yet been confirmed.

---

## 📌 Development Roadmap

The following areas should be reviewed and completed as needed:

- [ ] Verify income and expense CRUD functionality.
- [ ] Verify SQLite database persistence.
- [ ] Verify monthly summaries.
- [ ] Verify monthly carry-forward behavior.
- [ ] Test financial calculation edge cases.
- [ ] Verify app behavior after restarting.
- [ ] Implement or verify safe database migrations.
- [ ] Review accessibility and responsive layouts.
- [ ] Add automated tests for financial calculations.
- [ ] Resolve Android release build issues.
- [ ] Generate and test an installable APK.
- [ ] Prepare production release documentation.

These checkboxes are verification tasks. They do not necessarily mean the corresponding feature is missing.

---

## 🤝 Contributing

Contributions and improvements are welcome.

For collaborative development:

1. Fork the repository or obtain collaborator access.
2. Create a feature branch.
3. Make focused changes.
4. Test the changes.
5. Commit with a descriptive message.
6. Open a Pull Request.

Please avoid committing generated files, credentials, local databases, or unnecessary dependencies.

---

## 📄 License

No license has been specified yet.

All rights are reserved by default until the repository owner adds an appropriate license. If open-source redistribution and modification are intended, add a suitable `LICENSE` file.

---

## 📬 Project Maintenance

**Project:** Pocket Ledger
**Repository:** MoneyTracker-SDK58
**Maintained through:** GitHub

For bug reports, feature requests, and development discussions, use the repository's GitHub Issues and Pull Requests.

---

**Pocket Ledger — Track your money, understand your balance, and manage your finances offline.**
