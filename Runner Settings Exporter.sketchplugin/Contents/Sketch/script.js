var onRun = function (context) {
  const kPluginDomain = "com.sketchrunner.Runner";
  const fm = NSFileManager.defaultManager();

  const configURL = AppController.sharedInstance()
    .pluginManager()
    .mainPluginsFolderURL()
    .URLByDeletingLastPathComponent()
    .URLByAppendingPathComponent("Runner")
    .URLByAppendingPathComponent("config")
    .URLByAppendingPathExtension("json");
  const iconsFolderURL = NSURL.fileURLWithPath(
    NSSearchPathForDirectoriesInDomains(
      NSApplicationSupportDirectory,
      NSUserDomainMask,
      true
    ).firstObject()
  )
    .URLByAppendingPathComponent(kPluginDomain)
    .URLByAppendingPathComponent(".action-icons");

  // Export
  if (context.command.identifier() == "exportSettings") {
    if (!fm.fileExistsAtPath(configURL.path())) {
      context.document.showMessage("Runner settings were not found!");
      return;
    }

    const tempFolderURL = fm
      .URLsForDirectory_inDomains(NSCachesDirectory, NSUserDomainMask)
      .lastObject()
      .URLByAppendingPathComponent(kPluginDomain)
      .URLByAppendingPathComponent("settings");
    fm.createDirectoryAtURL_withIntermediateDirectories_attributes_error(
      tempFolderURL,
      true,
      nil,
      nil
    );

    const configDestination = tempFolderURL
      .URLByAppendingPathComponent("config")
      .URLByAppendingPathExtension("json");
    fm.copyItemAtURL_toURL_error(configURL, configDestination, nil);

    const iconsDestination = tempFolderURL.URLByAppendingPathComponent(
      ".action-icons"
    );
    fm.copyItemAtURL_toURL_error(iconsFolderURL, iconsDestination, nil);

    const zipURL = tempFolderURL.URLByAppendingPathExtension("zip");
    let zipper = NSTask.alloc().init();
    zipper.setLaunchPath("/usr/bin/zip");
    zipper.setCurrentDirectoryPath(
      tempFolderURL.URLByDeletingLastPathComponent().path()
    );
    zipper.setArguments([
      "-r",
      zipURL.path(),
      tempFolderURL.lastPathComponent(),
    ]);

    context.document.showMessage("Exporting settings...");

    zipper.launch();
    zipper.waitUntilExit();

    const zipDestination = fm
      .URLsForDirectory_inDomains(NSDesktopDirectory, NSUserDomainMask)
      .lastObject()
      .URLByAppendingPathComponent("RunnerSettings")
      .URLByAppendingPathExtension("zip");

    fm.moveItemAtPath_toPath_error(zipURL.path(), zipDestination.path(), nil);

    context.document.showMessage("Settings saved to " + zipDestination.path());

    NSWorkspace.sharedWorkspace().activateFileViewerSelectingURLs([
      zipDestination,
    ]);
  } else if (context.command.identifier() == "importSettings") {
    // Import
    var panel = NSOpenPanel.openPanel();
    panel.setCanChooseDirectories(false);
    panel.setCanChooseFiles(true);
    panel.setCanCreateDirectories(false);
    panel.setAllowedFileTypes(["zip"]);
    if (panel.runModal() != NSModalResponseOK) {
      return;
    }

    const zipURL = panel.URL();
    const tempFolderURL = NSURL.fileURLWithPath_isDirectory(
      NSTemporaryDirectory(),
      true
    ).URLByAppendingPathComponent(
      NSProcessInfo.processInfo().globallyUniqueString()
    );

    let zipper = NSTask.alloc().init();
    zipper.setLaunchPath("/usr/bin/unzip");
    zipper.setArguments(["-o", zipURL.path(), "-d", tempFolderURL.path()]);

    zipper.launch();
    zipper.waitUntilExit();

    const settingsFolderURL = tempFolderURL.URLByAppendingPathComponent(
      "settings"
    );
    const contentURLs = fm.contentsOfDirectoryAtURL_includingPropertiesForKeys_options_error(
      settingsFolderURL,
      nil,
      0,
      nil
    );
    const loop = contentURLs.objectEnumerator();
    let url;
    let valid = false;
    while ((url = loop.nextObject())) {
      if (url.lastPathComponent().hasPrefix("config")) {
        valid = true;
        fm.replaceItemAtURL_withItemAtURL_backupItemName_options_resultingItemURL_error(
          configURL,
          url,
          "config-backup",
          NSFileManagerItemReplacementUsingNewMetadataOnly,
          nil,
          nil
        );
      }
      if (url.lastPathComponent() == ".action-icons") {
        fm.replaceItemAtURL_withItemAtURL_backupItemName_options_resultingItemURL_error(
          iconsFolderURL,
          url,
          "icons-backup",
          NSFileManagerItemReplacementUsingNewMetadataOnly,
          nil,
          nil
        );
      }
    }
    if (valid) {
      const alert = NSAlert.alloc().init();
      alert.setMessageText("Runner settings imported and applied");
      alert.setInformativeText(
        "Please quit and restart Sketch to see the changes."
      );
      alert.addButtonWithTitle("Later");
      alert.addButtonWithTitle("Quit Sketch");
      if (alert.runModal() == NSAlertSecondButtonReturn) {
        try {
          SketchRunner.restartSketch();
        } catch (e) {
          NSApp.terminate(nil);
        }
      }
    } else {
      const alert = NSAlert.alloc().init();
      alert.setMessageText("Invalid settings file");
      alert.setInformativeText(
        "Make sure you have the right settings zip file exported using this plugin."
      );
    }
  }
};
