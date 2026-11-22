import { dict, plural } from "$lib/shared/i18n";
import helpEn from "./pages/troubleshooting.md?raw";
import helpRu from "./pages/troubleshooting.ru.md?raw";
import helpUk from "./pages/troubleshooting.uk.md?raw";
import helpEs from "./pages/troubleshooting.es.md?raw";
import helpHi from "./pages/troubleshooting.hi.md?raw";

export const t = dict(
  {
    appearanceColors: {
      "dark-grey": "Dark Grey",
      "light-grey": "Light Grey",
      orange: "Orange",
      blue: "Blue",
      green: "Green",
    },
    watchAppearance: "Watch Frame",
    appearanceModel: "Model",
    appearanceColor: "Color",
    appearanceAuto: "Automatic",
    // watch-sheet
    connectYourWatch: "Connect your watch",
    overWebBluetooth: "CMF Watch Pro 2 / Pro 3 over Web Bluetooth.",
    connecting: "Connecting…",
    connect: "Connect",
    forgetHint:
      "Clear Chrome's device permission and the saved auth key — does not affect pairing state on the watch itself",
    forgetting: "Forgetting…",
    forgetDevice: "Forget device",
    beforeYouConnect: "Before you connect",
    noteOneApp:
      "The watch talks to one app at a time. Close Nothing X before you connect, and close this tab when you're done.",
    noteInstaller:
      "Watchfaces go through the watch's own installer, and the watch can refuse them.",
    noteIphoneBefore: "On an iPhone, use ",
    noteIphoneAfter:
      ", and first swipe away every app that holds the watch, like Nothing X or a fitness app. In Settings → Bluetooth the watch should read Not Connected.",
    noteNothingX:
      "If Nothing X loses the watch afterwards, pair it again. Turn Bluetooth off and on, forget the watch, add it back.",
    readFullNotes: "Read the full notes",
    copyLog: "Copy log",
    battery: "Battery",
    firmware: "Firmware",
    serial: "Serial",
    developer: "Developer",
    watchfacesOnWatch: (used: number, capacity: number) =>
      `Watchfaces on the watch (${used} of ${capacity})`,
    reportedNone: "the watch reported none",
    companionApp: "FMC Companion mobile app",
    // watch-selector
    removeFromList: (name: string) => `Remove ${name} from this list`,
    removeHint: "Deleted it on the watch? FMC can't see that. Remove it from this list.",
    // size-dialog / slot-dialog
    tooBig: "This face may be too big for the watch",
    cancel: "Cancel",
    installAnyway: "Install anyway",
    watchFull: "The watch is full",
    pickToReplace:
      "Pick the watchface to replace — its slot number matches the order the watch shows them in.",
    // dev-sheet
    onTheWatch: "On the watch",
    connectFirst: "Connect the watch first.",
    checkingWatch: "Checking the watch…",
    stockNoStub: "Stock firmware — no App Loader stub, apps can't go on.",
    slot: (n: string) => `Slot ${n}`,
    localBuild: "Local build",
    localBuildDesc:
      "An app or App Loader .wp2app, or a firmware image, from your disk — through the same checks as the store. After a rebuild, Install again sends the new file.",
    anotherFile: "Another file",
    pickFile: "Pick a file",
    installAgain: "Install again",
    install: "Install",
    fileMeta: (kb: string, time: string) => `${kb} KB, modified ${time}`,
    firmwareRisk:
      "A firmware image can brick the watch. Battery at 50% or more, on the charger, tab open until it's done.",
    rollbackRisk:
      "Before installing stock or older firmware, switch to a built-in face and delete Watch 3 Pro faces with animated or data widgets from the watch: older firmware can restart in a loop on them.",
    acceptRisk: "I accept the risk",
    installingOnWatch: "Installing on the watch",
    isOnWatch: (name: string) => `${name} is on the watch.`,
    sentRestarts: "Sent. The watch installs it and restarts.",
    // ble.model / dev.model / rescue.model
    connectFirstErr: "connect the watch first",
    lowBattery: (battery: number, min: number) =>
      `battery at ${battery}% — charge it to ${min}% and keep it on the charger`,
    stockFirmwareErr: "the watch runs stock firmware — flash the patched firmware first",
    forgot: (n: number) => `forgot ${n} device(s) — connect to pick again`,
    nothingToForget: "nothing to forget",
    filePickerDesc: "App package or firmware image",
    deleteFaces: (n: number) =>
      `Delete the ${n} ${n === 1 ? "face" : "faces"} installed from this browser`,
    deletingFaces: "deleting the faces installed from this browser…",
    facesDeleted: (n: number) =>
      n
        ? `Deleted ${n} ${n === 1 ? "face" : "faces"}. Restart the watch: hold the button for 15 seconds. If it still goes black, use the factory reset.`
        : "The watch had none of the faces installed from this browser. Use the factory reset.",
    deleteFacesHint:
      "Gentler than a reset: only the faces this browser installed go, everything else stays. Not yet confirmed on a stuck watch — if it doesn't help, use the factory reset.",
    rescueRetrying: (n: number) => `waiting for the watch — attempt ${n}…`,
    stockFace: "Switch to a stock face (Watch 3 Pro)",
    stockFaceHint:
      "For a Watch 3 Pro stuck restarting on a face: the watch forgets its installed faces and starts on a stock one. No key needed, nothing is wiped. Works on firmware 1.0.1.77 in our emulator, not yet confirmed on a real watch — keep the watch near the computer and let it run for a few minutes.",
    switchingToStock: "switching to a stock face…",
    stockFaceDone:
      "Done: the watch stayed connected, so it is no longer restarting. The faces you installed are gone from its list; put back the ones you want.",
    stopRescue: "Stop",
    rescueKeyHint:
      "Coming from another browser, or from the old address fmc.freethinkel.dev? Open /rescue there, copy what it shows and paste it here.",
    rescueKeySave: "Save key",
    rescueKeyBad:
      "There is no key in this text. It is the line fmc_authkey= followed by 32 characters, 0–9 and a–f.",
    rescueKeySaved: "Key saved. Start below: this needs no tap on the watch.",
    rescueNoKey:
      "This browser has no saved key for a watch, so rescue has to pair, and pairing waits for a tap on the watch. If you installed the face from another browser, open this page there. Otherwise start anyway: each time the status says “confirm on the watch”, press the crown and tap the screen, even if it stays black. We haven't confirmed that a black screen takes the tap.",
    sendingReset: "sending factory reset…",
    // rescue page
    rescueTitle: "Rescue — FMC",
    rescue: "Rescue",
    rescueIntro:
      "For a watch that shows the CMF logo, goes black and stays there, but still shows up in the Bluetooth picker. This sends the watch a <strong>factory reset</strong> and nothing else: no file, no sync. Everything on the watch is wiped, including the face that broke it.",
    rescueBrowser:
      "Use the same browser you installed the face from — pairing needs a tap on the watch, and the key saved from that install is the only way around a screen that doesn't light up. Close Nothing X first so it isn't holding the watch.",
    factoryReset: "Factory reset the watch",
    rescueSent: (href: string) =>
      `Sent. The watch should restart on its own within a minute. If it does, or if the step above is where it stopped, <a href="${href}">tell us</a> — nobody has confirmed this path yet.`,
    sendLog: "Whatever happened, send us this log:",
    backToBefore: "Back to “Before you connect”",
    // troubleshooting page
    helpTitle: "Before you connect — FMC",
    helpDescription:
      "What FMC does to your CMF watch, what it cannot do, and how to fix the Bluetooth conflict with the Nothing X app.",
    help: helpEn,
    backToFaces: "Back to the watchfaces",
    // after a flash that had to compress images (bleModel.$fitNote)
    fitNote: (n: number) =>
      `${n} ${n === 1 ? "image was" : "images were"} compressed to fit the watch's memory — they can look slightly softer than in the editor.`,
  },
  {
    ru: {
      appearanceColors: {
        "dark-grey": "Тёмно-серый",
        "light-grey": "Светло-серый",
        orange: "Оранжевый",
        blue: "Синий",
        green: "Зелёный",
      },
      watchAppearance: "Корпус часов",
      appearanceModel: "Модель",
      appearanceColor: "Цвет",
      appearanceAuto: "Автоматически",

      connectYourWatch: "Подключите часы",
      overWebBluetooth: "CMF Watch Pro 2 / Pro 3 через Web Bluetooth.",
      connecting: "Подключение…",
      connect: "Подключить",
      forgetHint:
        "Сбросить разрешение Chrome на устройство и сохранённый ключ — сопряжение на самих часах не меняется",
      forgetting: "Сброс…",
      forgetDevice: "Забыть устройство",
      beforeYouConnect: "Перед подключением",
      noteOneApp:
        "Часы работают только с одним приложением за раз. Закройте Nothing X перед подключением, а когда закончите — эту вкладку.",
      noteInstaller: "Циферблаты ставит штатный установщик часов, и часы могут их отклонить.",
      noteIphoneBefore: "На iPhone используйте ",
      noteIphoneAfter:
        ", а сначала смахните все приложения, которые держат часы, например Nothing X или фитнес-приложение. В Настройки → Bluetooth у часов должно быть «Не подключено».",
      noteNothingX:
        "Если потом Nothing X перестанет видеть часы, подключите их заново: выключите и включите Bluetooth, забудьте часы и добавьте снова.",
      readFullNotes: "Подробнее",
      copyLog: "Скопировать лог",
      battery: "Батарея",
      firmware: "Прошивка",
      serial: "Серийный №",
      developer: "Разработчик",
      watchfacesOnWatch: (used: number, capacity: number) =>
        `Циферблаты на часах (${used} из ${capacity})`,
      reportedNone: "часы не сообщили ни одного",
      companionApp: "Мобильное приложение FMC Companion",
      removeFromList: (name: string) => `Убрать ${name} из списка`,
      removeHint: "Удалили его на часах? FMC этого не видит. Уберите его из списка.",
      tooBig: "Циферблат может оказаться слишком большим для часов",
      cancel: "Отмена",
      installAnyway: "Всё равно установить",
      watchFull: "На часах нет места",
      pickToReplace: "Выберите циферблат для замены — номер слота совпадает с порядком на часах.",
      onTheWatch: "На часах",
      connectFirst: "Сначала подключите часы.",
      checkingWatch: "Проверяем часы…",
      stockNoStub: "Стоковая прошивка — без stub от App Loader приложения не установить.",
      slot: (n: string) => `Слот ${n}`,
      localBuild: "Локальная сборка",
      localBuildDesc:
        "Приложение или App Loader в .wp2app либо образ прошивки с диска — с теми же проверками, что и в магазине. После пересборки «Установить снова» отправит новый файл.",
      anotherFile: "Другой файл",
      pickFile: "Выбрать файл",
      installAgain: "Установить снова",
      install: "Установить",
      fileMeta: (kb: string, time: string) => `${kb} КБ, изменён в ${time}`,
      firmwareRisk:
        "Образ прошивки может превратить часы в кирпич. Заряд от 50%, часы на зарядке, вкладка открыта до конца установки.",
      rollbackRisk:
        "Перед установкой стоковой или более старой прошивки включите встроенный циферблат и удалите с часов циферблаты Watch 3 Pro с анимацией и виджетами данных: на старой прошивке часы могут зациклиться на перезагрузке.",
      acceptRisk: "Я принимаю риск",
      installingOnWatch: "Установка на часы",
      isOnWatch: (name: string) => `«${name}» уже на часах.`,
      sentRestarts: "Отправлено. Часы установят прошивку и перезагрузятся.",
      connectFirstErr: "сначала подключите часы",
      lowBattery: (battery: number, min: number) =>
        `заряд ${battery}% — зарядите до ${min}% и оставьте на зарядке`,
      stockFirmwareErr: "на часах стоковая прошивка — сначала установите патченую",
      forgot: (n: number) =>
        `забыто ${n} ${plural("ru", n, { one: "устройство", few: "устройства", many: "устройств" })} — подключитесь, чтобы выбрать снова`,
      nothingToForget: "забывать нечего",
      filePickerDesc: "Пакет приложения или образ прошивки",
      deleteFaces: (n: number) =>
        `Удалить ${n} ${plural("ru", n, { one: "циферблат", few: "циферблата", many: "циферблатов" })}, установленных из этого браузера`,
      deletingFaces: "удаление циферблатов, установленных из этого браузера…",
      facesDeleted: (n: number) =>
        n
          ? `Удалено: ${n}. Перезапустите часы — удерживайте кнопку 15 секунд. Если экран всё равно гаснет, сделайте сброс до заводских.`
          : "На часах нет циферблатов, установленных из этого браузера. Сделайте сброс до заводских.",
      deleteFacesHint:
        "Бережнее сброса: уходят только циферблаты, установленные из этого браузера, всё остальное остаётся. На зависших часах ещё не проверено — если не поможет, сделайте сброс до заводских.",
      rescueRetrying: (n: number) => `ожидание часов — попытка ${n}…`,
      stockFace: "Переключить на стоковый циферблат (Watch 3 Pro)",
      stockFaceHint:
        "Для Watch 3 Pro, который перезагружается на циферблате по кругу: часы забывают установленные циферблаты и запускаются со стокового. Ключ не нужен, ничего не стирается. Работает на прошивке 1.0.1.77 в нашем эмуляторе, на настоящих часах пока не подтверждено — держите часы рядом с компьютером и дайте поработать несколько минут.",
      switchingToStock: "переключение на стоковый циферблат…",
      stockFaceDone:
        "Готово: часы остались на связи, значит, больше не перезагружаются. Установленных циферблатов в их списке больше нет — поставьте нужные заново.",
      stopRescue: "Стоп",
      rescueKeyHint:
        "Ключ остался в другом браузере или на старом адресе fmc.freethinkel.dev? Откройте там /rescue, скопируйте текст и вставьте сюда.",
      rescueKeySave: "Сохранить ключ",
      rescueKeyBad:
        "В этом тексте нет ключа. Это строка fmc_authkey= и 32 символа после неё, 0–9 и a–f.",
      rescueKeySaved: "Ключ сохранён. Запускайте ниже: нажатие на часах не понадобится.",
      rescueNoKey:
        "В этом браузере нет сохранённого ключа часов, поэтому восстановлению придётся выполнить сопряжение, а его нужно подтвердить нажатием на часах. Если вы ставили циферблат из другого браузера, откройте эту страницу там. Иначе всё равно запускайте: каждый раз, когда статус просит подтвердить на часах, нажмите колёсико и коснитесь экрана, даже если он остаётся чёрным. Мы не проверяли, что чёрный экран принимает нажатие.",
      sendingReset: "отправка сброса до заводских настроек…",
      rescueTitle: "Восстановление — FMC",
      rescue: "Восстановление",
      rescueIntro:
        "Для часов, которые показывают логотип CMF, гаснут и так и остаются, но всё ещё видны в списке Bluetooth. Здесь часам отправляется <strong>сброс до заводских настроек</strong> и больше ничего: ни файлов, ни синхронизации. С часов стирается всё, включая циферблат, который их сломал.",
      rescueBrowser:
        "Используйте тот же браузер, из которого ставили циферблат: для сопряжения нужно нажать на часах, а ключ, сохранённый при той установке, — единственный способ обойти неработающий экран. Сначала закройте Nothing X, чтобы оно не держало часы.",
      factoryReset: "Сбросить часы до заводских",
      rescueSent: (href: string) =>
        `Отправлено. Часы должны сами перезагрузиться в течение минуты. Если так и вышло или всё остановилось на шаге выше, <a href="${href}">напишите нам</a> — этот путь ещё никто не подтвердил.`,
      sendLog: "Что бы ни случилось, пришлите нам этот лог:",
      backToBefore: "Назад к «Перед подключением»",
      helpTitle: "Перед подключением — FMC",
      helpDescription:
        "Что FMC делает с вашими часами CMF, чего он не умеет и как решить конфликт Bluetooth с приложением Nothing X.",
      fitNote: (n: number) =>
        `${n} ${plural("ru", n, { one: "изображение сжато", few: "изображения сжаты", many: "изображений сжато" })}, чтобы циферблат поместился в память часов — на часах они могут выглядеть чуть мягче, чем в редакторе.`,
      help: helpRu,
      backToFaces: "К циферблатам",
    },
    uk: {
      appearanceColors: {
        "dark-grey": "Темно-сірий",
        "light-grey": "Світло-сірий",
        orange: "Помаранчевий",
        blue: "Синій",
        green: "Зелений",
      },
      watchAppearance: "Корпус годинника",
      appearanceModel: "Модель",
      appearanceColor: "Колір",
      appearanceAuto: "Автоматично",

      connectYourWatch: "Підключіть годинник",
      overWebBluetooth: "CMF Watch Pro 2 / Pro 3 через Web Bluetooth.",
      connecting: "Підключення…",
      connect: "Підключити",
      forgetHint:
        "Скинути дозвіл Chrome на пристрій і збережений ключ — сполучення на самому годиннику не зміниться",
      forgetting: "Скидання…",
      forgetDevice: "Забути пристрій",
      beforeYouConnect: "Перед підключенням",
      noteOneApp:
        "Годинник працює лише з одним застосунком водночас. Закрийте Nothing X перед підключенням, а коли закінчите — цю вкладку.",
      noteInstaller:
        "Циферблати встановлює власний інсталятор годинника, і годинник може їх відхилити.",
      noteIphoneBefore: "На iPhone користуйтеся ",
      noteIphoneAfter:
        ", а спершу змахніть усі застосунки, що тримають годинник, як-от Nothing X чи фітнес-застосунок. У Параметри → Bluetooth годинник має бути «Не під’єднано».",
      noteNothingX:
        "Якщо потім Nothing X перестане бачити годинник, сполучіть його знову: вимкніть і ввімкніть Bluetooth, забудьте годинник і додайте ще раз.",
      readFullNotes: "Докладніше",
      copyLog: "Скопіювати лог",
      battery: "Батарея",
      firmware: "Прошивка",
      serial: "Серійний №",
      developer: "Розробник",
      watchfacesOnWatch: (used: number, capacity: number) =>
        `Циферблати на годиннику (${used} з ${capacity})`,
      reportedNone: "годинник не повідомив жодного",
      companionApp: "Мобільний застосунок FMC Companion",
      removeFromList: (name: string) => `Прибрати ${name} зі списку`,
      removeHint: "Видалили його на годиннику? FMC цього не бачить. Приберіть його зі списку.",
      tooBig: "Циферблат може бути завеликим для годинника",
      cancel: "Скасувати",
      installAnyway: "Усе одно встановити",
      watchFull: "На годиннику немає місця",
      pickToReplace:
        "Виберіть циферблат для заміни — номер слота збігається з порядком на годиннику.",
      onTheWatch: "На годиннику",
      connectFirst: "Спершу підключіть годинник.",
      checkingWatch: "Перевіряємо годинник…",
      stockNoStub: "Стокова прошивка — без stub від App Loader застосунки не встановити.",
      slot: (n: string) => `Слот ${n}`,
      localBuild: "Локальна збірка",
      localBuildDesc:
        "Застосунок чи App Loader у .wp2app або образ прошивки з диска — з тими самими перевірками, що й у магазині. Після перезбирання «Встановити знову» надішле новий файл.",
      anotherFile: "Інший файл",
      pickFile: "Вибрати файл",
      installAgain: "Встановити знову",
      install: "Встановити",
      fileMeta: (kb: string, time: string) => `${kb} КБ, змінено о ${time}`,
      firmwareRisk:
        "Образ прошивки може перетворити годинник на цеглину. Заряд від 50%, годинник на зарядці, вкладка відкрита до кінця встановлення.",
      rollbackRisk:
        "Перед встановленням стокової або старішої прошивки увімкніть вбудований циферблат і видаліть з годинника циферблати Watch 3 Pro з анімацією та віджетами даних: на старій прошивці годинник може циклічно перезавантажуватися.",
      acceptRisk: "Я приймаю ризик",
      installingOnWatch: "Встановлення на годинник",
      isOnWatch: (name: string) => `«${name}» уже на годиннику.`,
      sentRestarts: "Надіслано. Годинник установить прошивку й перезавантажиться.",
      connectFirstErr: "спершу підключіть годинник",
      lowBattery: (battery: number, min: number) =>
        `заряд ${battery}% — зарядіть до ${min}% і залиште на зарядці`,
      stockFirmwareErr: "на годиннику стокова прошивка — спершу встановіть патчену",
      forgot: (n: number) =>
        `забуто ${n} ${plural("uk", n, { one: "пристрій", few: "пристрої", many: "пристроїв" })} — підключіться, щоб вибрати знову`,
      nothingToForget: "нічого забувати",
      filePickerDesc: "Пакет застосунку або образ прошивки",
      deleteFaces: (n: number) =>
        `Видалити ${n} ${plural("uk", n, { one: "циферблат", few: "циферблати", many: "циферблатів" })}, встановлених із цього браузера`,
      deletingFaces: "видалення циферблатів, встановлених із цього браузера…",
      facesDeleted: (n: number) =>
        n
          ? `Видалено: ${n}. Перезапустіть годинник — утримуйте кнопку 15 секунд. Якщо екран усе одно гасне, скиньте до заводських налаштувань.`
          : "На годиннику немає циферблатів, встановлених із цього браузера. Скиньте до заводських налаштувань.",
      deleteFacesHint:
        "Дбайливіше за скидання: зникають лише циферблати, встановлені з цього браузера, усе інше лишається. На завислому годиннику ще не перевірено — якщо не допоможе, скиньте до заводських налаштувань.",
      rescueRetrying: (n: number) => `очікування годинника — спроба ${n}…`,
      stockFace: "Перемкнути на стоковий циферблат (Watch 3 Pro)",
      stockFaceHint:
        "Для Watch 3 Pro, що перезавантажується на циферблаті по колу: годинник забуває встановлені циферблати й запускається зі стокового. Ключ не потрібен, нічого не стирається. Працює на прошивці 1.0.1.77 у нашому емуляторі, на справжньому годиннику ще не підтверджено — тримайте годинник біля комп’ютера й дайте попрацювати кілька хвилин.",
      switchingToStock: "перемикання на стоковий циферблат…",
      stockFaceDone:
        "Готово: годинник лишився на зв’язку, отже, більше не перезавантажується. Встановлених циферблатів у його списку більше немає — поставте потрібні знову.",
      stopRescue: "Стоп",
      rescueKeyHint:
        "Ключ лишився в іншому браузері або на старій адресі fmc.freethinkel.dev? Відкрийте там /rescue, скопіюйте текст і вставте сюди.",
      rescueKeySave: "Зберегти ключ",
      rescueKeyBad:
        "У цьому тексті немає ключа. Це рядок fmc_authkey= і 32 символи після нього, 0–9 та a–f.",
      rescueKeySaved: "Ключ збережено. Запускайте нижче: дотик до годинника не знадобиться.",
      rescueNoKey:
        "У цьому браузері немає збереженого ключа годинника, тому відновленню доведеться виконати сполучення, а його треба підтвердити дотиком на годиннику. Якщо ви встановлювали циферблат з іншого браузера, відкрийте цю сторінку там. Інакше все одно запускайте: щоразу, коли статус просить підтвердити на годиннику, натисніть коліщатко й торкніться екрана, навіть якщо він лишається чорним. Ми не перевіряли, що чорний екран приймає дотик.",
      sendingReset: "надсилання скидання до заводських налаштувань…",
      rescueTitle: "Відновлення — FMC",
      rescue: "Відновлення",
      rescueIntro:
        "Для годинника, який показує логотип CMF, гасне й так і лишається, але досі видимий у списку Bluetooth. Тут годиннику надсилається <strong>скидання до заводських налаштувань</strong> і більше нічого: ні файлів, ні синхронізації. З годинника стирається все, зокрема циферблат, що його зламав.",
      rescueBrowser:
        "Використовуйте той самий браузер, з якого встановлювали циферблат: для сполучення треба торкнутися годинника, а ключ, збережений під час того встановлення, — єдиний спосіб обійти екран, що не світиться. Спершу закрийте Nothing X, щоб він не тримав годинник.",
      factoryReset: "Скинути годинник до заводських",
      rescueSent: (href: string) =>
        `Надіслано. Годинник має сам перезавантажитися протягом хвилини. Якщо так і сталося або все зупинилося на кроці вище, <a href="${href}">напишіть нам</a> — цей шлях ще ніхто не підтвердив.`,
      sendLog: "Хай що сталося, надішліть нам цей лог:",
      backToBefore: "Назад до «Перед підключенням»",
      helpTitle: "Перед підключенням — FMC",
      helpDescription:
        "Що FMC робить з вашим годинником CMF, чого він не вміє і як усунути конфлікт Bluetooth із застосунком Nothing X.",
      fitNote: (n: number) =>
        `${n} ${plural("uk", n, { one: "зображення стиснуто", few: "зображення стиснуто", many: "зображень стиснуто" })}, щоб циферблат помістився в пам'ять годинника — на годиннику вони можуть виглядати трохи м'якше, ніж у редакторі.`,
      help: helpUk,
      backToFaces: "До циферблатів",
    },
    es: {
      appearanceColors: {
        "dark-grey": "Gris oscuro",
        "light-grey": "Gris claro",
        orange: "Naranja",
        blue: "Azul",
        green: "Verde",
      },
      watchAppearance: "Marco del reloj",
      appearanceModel: "Modelo",
      appearanceColor: "Color",
      appearanceAuto: "Automático",

      connectYourWatch: "Conecta tu reloj",
      overWebBluetooth: "CMF Watch Pro 2 / Pro 3 por Web Bluetooth.",
      connecting: "Conectando…",
      connect: "Conectar",
      forgetHint:
        "Borra el permiso del dispositivo en Chrome y la clave guardada — no cambia el emparejamiento en el propio reloj",
      forgetting: "Olvidando…",
      forgetDevice: "Olvidar dispositivo",
      beforeYouConnect: "Antes de conectar",
      noteOneApp:
        "El reloj habla con una sola app a la vez. Cierra Nothing X antes de conectar y cierra esta pestaña cuando termines.",
      noteInstaller:
        "Las esferas pasan por el instalador del propio reloj, y el reloj puede rechazarlas.",
      noteIphoneBefore: "En iPhone, usa ",
      noteIphoneAfter:
        " y antes cierra del todo cada app que tenga el reloj, como Nothing X o una app de fitness. En Ajustes → Bluetooth el reloj debe decir No conectado.",
      noteNothingX:
        "Si después Nothing X pierde el reloj, vuelve a emparejarlo: apaga y enciende el Bluetooth, olvida el reloj y agrégalo de nuevo.",
      readFullNotes: "Leer las notas completas",
      copyLog: "Copiar registro",
      battery: "Batería",
      firmware: "Firmware",
      serial: "N.º de serie",
      developer: "Desarrollador",
      watchfacesOnWatch: (used: number, capacity: number) =>
        `Esferas en el reloj (${used} de ${capacity})`,
      reportedNone: "el reloj no informó ninguna",
      companionApp: "App móvil FMC Companion",
      removeFromList: (name: string) => `Quitar ${name} de esta lista`,
      removeHint: "¿La borraste en el reloj? FMC no puede verlo. Quítala de esta lista.",
      tooBig: "Esta esfera puede ser demasiado grande para el reloj",
      cancel: "Cancelar",
      installAnyway: "Instalar igual",
      watchFull: "El reloj está lleno",
      pickToReplace:
        "Elige la esfera que quieres reemplazar — su número de ranura coincide con el orden en que el reloj las muestra.",
      onTheWatch: "En el reloj",
      connectFirst: "Primero conecta el reloj.",
      checkingWatch: "Revisando el reloj…",
      stockNoStub: "Firmware de fábrica — sin el stub de App Loader no se pueden instalar apps.",
      slot: (n: string) => `Ranura ${n}`,
      localBuild: "Build local",
      localBuildDesc:
        "Una app o App Loader en .wp2app, o una imagen de firmware, desde tu disco — con las mismas comprobaciones que la tienda. Tras recompilar, Instalar de nuevo envía el archivo nuevo.",
      anotherFile: "Otro archivo",
      pickFile: "Elegir archivo",
      installAgain: "Instalar de nuevo",
      install: "Instalar",
      fileMeta: (kb: string, time: string) => `${kb} KB, modificado a las ${time}`,
      firmwareRisk:
        "Una imagen de firmware puede dejar el reloj inservible. Batería al 50 % o más, en el cargador y la pestaña abierta hasta que termine.",
      rollbackRisk:
        "Antes de instalar firmware original o anterior, cambia a una esfera integrada y borra del reloj las esferas del Watch 3 Pro con animaciones o widgets de datos: con un firmware anterior el reloj puede reiniciarse en bucle.",
      acceptRisk: "Acepto el riesgo",
      installingOnWatch: "Instalando en el reloj",
      isOnWatch: (name: string) => `${name} ya está en el reloj.`,
      sentRestarts: "Enviado. El reloj lo instala y se reinicia.",
      connectFirstErr: "primero conecta el reloj",
      lowBattery: (battery: number, min: number) =>
        `batería al ${battery} % — cárgalo hasta el ${min} % y déjalo en el cargador`,
      stockFirmwareErr:
        "el reloj tiene el firmware de fábrica — instala primero el firmware modificado",
      forgot: (n: number) =>
        `${n} ${plural("es", n, { one: "dispositivo olvidado", other: "dispositivos olvidados" })} — conecta para elegir de nuevo`,
      nothingToForget: "no hay nada que olvidar",
      filePickerDesc: "Paquete de app o imagen de firmware",
      deleteFaces: (n: number) =>
        `Borrar ${n} ${plural("es", n, { one: "esfera instalada", other: "esferas instaladas" })} desde este navegador`,
      deletingFaces: "borrando las esferas instaladas desde este navegador…",
      facesDeleted: (n: number) =>
        n
          ? `Borradas: ${n}. Reinicia el reloj: mantén pulsado el botón 15 segundos. Si sigue quedándose en negro, restablece los datos de fábrica.`
          : "El reloj no tenía ninguna esfera instalada desde este navegador. Restablece los datos de fábrica.",
      deleteFacesHint:
        "Más suave que un restablecimiento: solo se van las esferas que instaló este navegador y todo lo demás se queda. Aún sin confirmar en un reloj bloqueado; si no ayuda, restablece los datos de fábrica.",
      rescueRetrying: (n: number) => `esperando al reloj — intento ${n}…`,
      stockFace: "Cambiar a una esfera de fábrica (Watch 3 Pro)",
      stockFaceHint:
        "Para un Watch 3 Pro que se reinicia una y otra vez en una esfera: el reloj olvida las esferas instaladas y arranca con una de fábrica. No hace falta clave y no se borra nada. Funciona con el firmware 1.0.1.77 en nuestro emulador, aún sin confirmar en un reloj real: deja el reloj cerca del ordenador unos minutos.",
      switchingToStock: "cambiando a una esfera de fábrica…",
      stockFaceDone:
        "Hecho: el reloj siguió conectado, así que ya no se reinicia. Las esferas que instalaste ya no están en su lista; vuelve a poner las que quieras.",
      stopRescue: "Detener",
      rescueKeyHint:
        "¿La clave quedó en otro navegador o en la dirección antigua fmc.freethinkel.dev? Abre /rescue allí, copia el texto y pégalo aquí.",
      rescueKeySave: "Guardar clave",
      rescueKeyBad:
        "No hay ninguna clave en este texto. Es la línea fmc_authkey= seguida de 32 caracteres, 0–9 y a–f.",
      rescueKeySaved: "Clave guardada. Empieza abajo: no hace falta tocar el reloj.",
      rescueNoKey:
        "Este navegador no tiene guardada una clave del reloj, así que el rescate tiene que emparejar, y eso hay que confirmarlo con un toque en el reloj. Si instalaste la esfera desde otro navegador, abre esta página allí. Si no, empieza igualmente: cada vez que el estado pida confirmar en el reloj, pulsa la corona y toca la pantalla, aunque siga en negro. No hemos comprobado que una pantalla en negro acepte el toque.",
      sendingReset: "enviando restablecimiento de fábrica…",
      rescueTitle: "Rescate — FMC",
      rescue: "Rescate",
      rescueIntro:
        "Para un reloj que muestra el logo de CMF, se pone en negro y se queda así, pero sigue apareciendo en el selector de Bluetooth. Esto le envía al reloj un <strong>restablecimiento de fábrica</strong> y nada más: ni archivos ni sincronización. Se borra todo lo que hay en el reloj, incluida la esfera que lo rompió.",
      rescueBrowser:
        "Usa el mismo navegador desde el que instalaste la esfera — el emparejamiento pide un toque en el reloj, y la clave guardada en esa instalación es la única forma de saltarse una pantalla que no enciende. Cierra antes Nothing X para que no retenga el reloj.",
      factoryReset: "Restablecer el reloj de fábrica",
      rescueSent: (href: string) =>
        `Enviado. El reloj debería reiniciarse solo en menos de un minuto. Si lo hace, o si se quedó en el paso de arriba, <a href="${href}">cuéntanos</a> — nadie ha confirmado todavía este camino.`,
      sendLog: "Pase lo que pase, envíanos este registro:",
      backToBefore: "Volver a «Antes de conectar»",
      helpTitle: "Antes de conectar — FMC",
      helpDescription:
        "Qué le hace FMC a tu reloj CMF, qué no puede hacer y cómo resolver el conflicto de Bluetooth con la app Nothing X.",
      fitNote: (n: number) =>
        `${n} ${plural("es", n, { one: "imagen se comprimió", other: "imágenes se comprimieron" })} para que la esfera quepa en la memoria del reloj — pueden verse algo más suaves que en el editor.`,
      help: helpEs,
      backToFaces: "Volver a las esferas",
    },
    hi: {
      appearanceColors: {
        "dark-grey": "गहरा स्लेटी",
        "light-grey": "हल्का स्लेटी",
        orange: "नारंगी",
        blue: "नीला",
        green: "हरा",
      },
      watchAppearance: "घड़ी का फ्रेम",
      appearanceModel: "मॉडल",
      appearanceColor: "रंग",
      appearanceAuto: "अपने आप",

      connectYourWatch: "अपनी घड़ी कनेक्ट करें",
      overWebBluetooth: "CMF Watch Pro 2 / Pro 3, Web Bluetooth से।",
      connecting: "कनेक्ट हो रहा है…",
      connect: "कनेक्ट करें",
      forgetHint:
        "Chrome की डिवाइस अनुमति और सेव की गई कुंजी हटाता है — घड़ी पर पेयरिंग पर इसका असर नहीं पड़ता",
      forgetting: "भुलाया जा रहा है…",
      forgetDevice: "डिवाइस भूलें",
      beforeYouConnect: "कनेक्ट करने से पहले",
      noteOneApp:
        "घड़ी एक समय में एक ही ऐप से बात करती है। कनेक्ट करने से पहले Nothing X बंद करें, और काम पूरा होने पर यह टैब बंद करें।",
      noteInstaller: "वॉचफ़ेस घड़ी के अपने इंस्टॉलर से जाते हैं, और घड़ी उन्हें मना कर सकती है।",
      noteIphoneBefore: "iPhone पर ",
      noteIphoneAfter:
        " इस्तेमाल करें, और पहले हर वह ऐप स्वाइप करके बंद करें जो घड़ी से जुड़ा है, जैसे Nothing X या कोई फ़िटनेस ऐप। Settings → Bluetooth में घड़ी Not Connected दिखनी चाहिए।",
      noteNothingX:
        "अगर बाद में Nothing X घड़ी को नहीं ढूंढ पाता, तो उसे फिर से पेयर करें। Bluetooth बंद करके चालू करें, घड़ी को भूलें, फिर से जोड़ें।",
      readFullNotes: "पूरे नोट्स पढ़ें",
      copyLog: "लॉग कॉपी करें",
      battery: "बैटरी",
      firmware: "फ़र्मवेयर",
      serial: "सीरियल",
      developer: "डेवलपर",
      watchfacesOnWatch: (used: number, capacity: number) =>
        `घड़ी पर वॉचफ़ेस (${capacity} में से ${used})`,
      reportedNone: "घड़ी ने कोई नहीं बताया",
      companionApp: "FMC Companion मोबाइल ऐप",
      removeFromList: (name: string) => `${name} को इस सूची से हटाएं`,
      removeHint: "घड़ी पर हटा दिया? FMC यह नहीं देख सकता। इसे इस सूची से हटाएं।",
      tooBig: "यह वॉचफ़ेस घड़ी के लिए बहुत बड़ा हो सकता है",
      cancel: "रद्द करें",
      installAnyway: "फिर भी इंस्टॉल करें",
      watchFull: "घड़ी भर गई है",
      pickToReplace: "बदलने के लिए वॉचफ़ेस चुनें — उसका स्लॉट नंबर घड़ी पर दिखने वाले क्रम से मेल खाता है।",
      onTheWatch: "घड़ी पर",
      connectFirst: "पहले घड़ी कनेक्ट करें।",
      checkingWatch: "घड़ी जांची जा रही है…",
      stockNoStub: "स्टॉक फ़र्मवेयर — App Loader stub नहीं है, ऐप्स इंस्टॉल नहीं हो सकते।",
      slot: (n: string) => `स्लॉट ${n}`,
      localBuild: "लोकल बिल्ड",
      localBuildDesc:
        "आपकी डिस्क से कोई ऐप या App Loader .wp2app, या फ़र्मवेयर इमेज — स्टोर जैसी ही जांच के साथ। दोबारा बिल्ड करने के बाद, “फिर से इंस्टॉल करें” नई फ़ाइल भेजता है।",
      anotherFile: "दूसरी फ़ाइल",
      pickFile: "फ़ाइल चुनें",
      installAgain: "फिर से इंस्टॉल करें",
      install: "इंस्टॉल करें",
      fileMeta: (kb: string, time: string) => `${kb} KB, ${time} पर बदली गई`,
      firmwareRisk:
        "फ़र्मवेयर इमेज घड़ी को हमेशा के लिए खराब (ब्रिक) कर सकती है। बैटरी 50% या ज़्यादा हो, घड़ी चार्जर पर हो, और काम पूरा होने तक टैब खुला रहे।",
      rollbackRisk:
        "स्टॉक या पुराना फ़र्मवेयर इंस्टॉल करने से पहले कोई बिल्ट-इन फ़ेस चुनें और Watch 3 Pro के एनिमेशन या डेटा विजेट वाले फ़ेस घड़ी से हटा दें: पुराने फ़र्मवेयर पर घड़ी बार-बार रीस्टार्ट हो सकती है।",
      acceptRisk: "जोखिम मुझे मंज़ूर है",
      installingOnWatch: "घड़ी पर इंस्टॉल हो रहा है",
      isOnWatch: (name: string) => `${name} घड़ी पर है।`,
      sentRestarts: "भेज दिया। घड़ी इसे इंस्टॉल करके रीस्टार्ट होगी।",
      connectFirstErr: "पहले घड़ी कनेक्ट करें",
      lowBattery: (battery: number, min: number) =>
        `बैटरी ${battery}% है — इसे ${min}% तक चार्ज करें और चार्जर पर ही रखें`,
      stockFirmwareErr: "घड़ी पर स्टॉक फ़र्मवेयर है — पहले पैच किया हुआ फ़र्मवेयर फ़्लैश करें",
      forgot: (n: number) => `${n} डिवाइस भुला दिए गए — फिर से चुनने के लिए कनेक्ट करें`,
      nothingToForget: "भूलने के लिए कुछ नहीं है",
      filePickerDesc: "ऐप पैकेज या फ़र्मवेयर इमेज",
      deleteFaces: (n: number) => `इस ब्राउज़र से इंस्टॉल किए गए ${n} फ़ेस हटाएं`,
      deletingFaces: "इस ब्राउज़र से इंस्टॉल किए गए फ़ेस हटाए जा रहे हैं…",
      facesDeleted: (n: number) =>
        n
          ? `${n} फ़ेस हटाए गए। घड़ी रीस्टार्ट करें: बटन 15 सेकंड दबाए रखें। अगर स्क्रीन फिर भी काली हो जाए, तो फ़ैक्टरी रीसेट करें।`
          : "घड़ी पर इस ब्राउज़र से इंस्टॉल किया कोई फ़ेस नहीं था। फ़ैक्टरी रीसेट करें।",
      deleteFacesHint:
        "रीसेट से हल्का: सिर्फ़ इस ब्राउज़र से इंस्टॉल किए गए फ़ेस हटते हैं, बाकी सब रहता है। अटकी घड़ी पर अभी पुष्टि नहीं हुई — अगर मदद न मिले, तो फ़ैक्टरी रीसेट करें।",
      rescueRetrying: (n: number) => `घड़ी का इंतज़ार — प्रयास ${n}…`,
      stockFace: "स्टॉक फ़ेस पर स्विच करें (Watch 3 Pro)",
      stockFaceHint:
        "उस Watch 3 Pro के लिए जो किसी फ़ेस पर बार-बार रीस्टार्ट होता है: घड़ी इंस्टॉल किए गए फ़ेस भूल जाती है और स्टॉक फ़ेस से शुरू होती है। कुंजी की ज़रूरत नहीं, कुछ भी मिटता नहीं। हमारे एमुलेटर में फ़र्मवेयर 1.0.1.77 पर काम करता है, असली घड़ी पर अभी पुष्टि नहीं हुई — घड़ी को कंप्यूटर के पास रखें और कुछ मिनट चलने दें।",
      switchingToStock: "स्टॉक फ़ेस पर स्विच हो रहा है…",
      stockFaceDone:
        "हो गया: घड़ी जुड़ी रही, यानी अब रीस्टार्ट नहीं हो रही। आपके इंस्टॉल किए फ़ेस उसकी सूची से हट गए हैं; जो चाहिए उन्हें फिर से लगाएँ।",
      stopRescue: "रोकें",
      rescueKeyHint:
        "key किसी और ब्राउज़र में या पुराने पते fmc.freethinkel.dev पर रह गई है? वहाँ /rescue खोलें, जो टेक्स्ट दिखे उसे कॉपी करें और यहाँ पेस्ट करें।",
      rescueKeySave: "key सेव करें",
      rescueKeyBad:
        "इस टेक्स्ट में key नहीं है। यह fmc_authkey= वाली लाइन है, जिसके बाद 32 अक्षर आते हैं, 0–9 और a–f।",
      rescueKeySaved: "key सेव हो गई। नीचे शुरू करें: घड़ी पर टैप की ज़रूरत नहीं पड़ेगी।",
      rescueNoKey:
        "इस ब्राउज़र में घड़ी की कोई सेव की हुई key नहीं है, इसलिए रेस्क्यू को पेयरिंग करनी होगी, और उसे घड़ी पर टैप करके पुष्टि करना पड़ता है। अगर आपने फ़ेस किसी और ब्राउज़र से इंस्टॉल किया था, तो यह पेज वहीं खोलें। नहीं तो फिर भी शुरू करें: जब भी स्टेटस घड़ी पर पुष्टि करने को कहे, क्राउन दबाएँ और स्क्रीन पर टैप करें, भले ही वह काली रहे। काली स्क्रीन टैप लेती है या नहीं, यह हमने जाँचा नहीं है।",
      sendingReset: "फ़ैक्टरी रीसेट भेजा जा रहा है…",
      rescueTitle: "रेस्क्यू — FMC",
      rescue: "रेस्क्यू",
      rescueIntro:
        "उस घड़ी के लिए जो CMF लोगो दिखाकर काली हो जाती है और वैसी ही रहती है, लेकिन Bluetooth पिकर में अब भी दिखती है। यह घड़ी को सिर्फ़ <strong>फ़ैक्टरी रीसेट</strong> भेजता है, और कुछ नहीं: न कोई फ़ाइल, न सिंक। घड़ी पर सब कुछ मिट जाता है, उस वॉचफ़ेस समेत जिसने उसे खराब किया।",
      rescueBrowser:
        "वही ब्राउज़र इस्तेमाल करें जिससे आपने वॉचफ़ेस इंस्टॉल किया था — पेयरिंग के लिए घड़ी पर टैप करना पड़ता है, और उस इंस्टॉल में सेव हुई कुंजी ही ऐसी स्क्रीन से बचने का एकमात्र तरीका है जो जलती नहीं। पहले Nothing X बंद करें ताकि वह घड़ी को पकड़े न रहे।",
      factoryReset: "घड़ी को फ़ैक्टरी रीसेट करें",
      rescueSent: (href: string) =>
        `भेज दिया। घड़ी को एक मिनट के अंदर अपने आप रीस्टार्ट होना चाहिए। अगर ऐसा होता है, या ऊपर वाले चरण पर ही रुक जाता है, तो <a href="${href}">हमें बताएं</a> — अभी तक किसी ने इस तरीके की पुष्टि नहीं की है।`,
      sendLog: "जो भी हुआ हो, हमें यह लॉग भेजें:",
      backToBefore: "“कनेक्ट करने से पहले” पर वापस",
      helpTitle: "कनेक्ट करने से पहले — FMC",
      helpDescription:
        "FMC आपकी CMF घड़ी के साथ क्या करता है, क्या नहीं कर सकता, और Nothing X ऐप के साथ Bluetooth की टक्कर कैसे ठीक करें।",
      fitNote: (n: number) =>
        `घड़ी की मेमोरी में फ़ेस फ़िट करने के लिए ${n} इमेज कंप्रेस की गईं — घड़ी पर वे एडिटर से थोड़ी धुंधली दिख सकती हैं।`,
      help: helpHi,
      backToFaces: "वॉचफ़ेस पर वापस",
    },
  },
);
