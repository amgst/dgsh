# Doomlings GenCon 2025 Scavenger Hunt

This repository contains the assets for the Doomlings scavenger hunt.

## Scanning Flow

1. `DGSHUI.handleCodeScan()` validates the QR code format and now calls `DGSHFirebase.validateQRCode` to ensure the code exists and is active before recording any scan.
2. The scan is recorded via `DGSHFirebase.addScannedCode`, which uses a Firestore transaction to avoid duplicate scans when multiple devices are used simultaneously.

The UI shows toast messages for success or errors. All user progress is stored in Firebase.
