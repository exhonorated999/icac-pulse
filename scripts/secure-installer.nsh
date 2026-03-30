# NSIS Script for Self-Destructing Installer
# This script makes the installer delete itself after successful installation
# Prevents re-use of the installer on multiple machines

!define PRODUCT_NAME "ICAC P.U.L.S.E."
!define PRODUCT_VERSION "1.0.0"
!define INSTALLATION_MARKER "$APPDATA\ICAC_CaseManager\.installed"

# Check if already installed
Section "PreInstallCheck"
  # Check for installation marker
  IfFileExists "${INSTALLATION_MARKER}" AlreadyInstalled Continue
  
  AlreadyInstalled:
    MessageBox MB_ICONSTOP "ICAC P.U.L.S.E. is already installed on this system.$\r$\n$\r$\nThis software is hardware-bound and cannot be reinstalled.$\r$\n$\r$\nIf you need to reinstall, please contact your ICAC coordinator."
    Abort "Installation cancelled - already installed"
  
  Continue:
SectionEnd

# After successful installation
Section "PostInstall"
  # Create installation marker
  CreateDirectory "$APPDATA\ICAC_CaseManager"
  FileOpen $0 "${INSTALLATION_MARKER}" w
  FileWrite $0 "Installed: $INSTDIR$\r$\n"
  FileWrite $0 "Date: $DATE$\r$\n"
  FileWrite $0 "Time: $TIME$\r$\n"
  FileClose $0
  
  # Hide the marker file
  SetFileAttributes "${INSTALLATION_MARKER}" HIDDEN|SYSTEM
  
  # Self-destruct installer after 10 seconds
  ExecWait 'cmd /c timeout /t 10 && del "$EXEPATH"' "" SW_HIDE
SectionEnd

# Uninstaller check
Section "Uninstall"
  # Require administrator confirmation
  MessageBox MB_YESNO|MB_ICONEXCLAMATION "WARNING: Uninstalling ICAC P.U.L.S.E. will permanently delete all case data.$\r$\n$\r$\nThis action cannot be undone.$\r$\n$\r$\nHave you backed up your cases?$\r$\n$\r$\nContinue with uninstall?" IDYES DoUninstall
  Abort "Uninstall cancelled by user"
  
  DoUninstall:
    # Remove installation marker
    Delete "${INSTALLATION_MARKER}"
    
    # Remove app data (with additional confirmation)
    MessageBox MB_YESNO|MB_ICONQUESTION "Delete all case data from $APPDATA\ICAC_CaseManager?$\r$\n$\r$\nThis will permanently erase all cases, evidence references, and settings." IDYES DeleteData IDNO KeepData
    
    DeleteData:
      RMDir /r "$APPDATA\ICAC_CaseManager"
    
    KeepData:
      # Keep data but remove marker
SectionEnd
