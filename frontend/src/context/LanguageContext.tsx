import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'en' | 'om' | 'am';

export const LANGUAGE_OPTIONS: Array<{ code: Language; label: string; nativeName: string }> = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'om', label: 'Afaan Oromo', nativeName: 'Afaan Oromoo' },
  { code: 'am', label: 'Amharic', nativeName: 'አማርኛ' },
];

const translations: Record<Exclude<Language, 'en'>, Record<string, string>> = {
  om: {
    'Dashboard': 'Daashboordii', 'Staff Accounts': 'Herrega Hojjettootaa', 'Patients': 'Dhukkubsattoota',
    'Appointments': 'Beellamoota', 'Medical Records': 'Galmee Fayyaa', 'Messages': 'Ergaawwan',
    'Notifications': 'Beeksisa', 'Pharmacy & Inventory': 'Faramaasii fi Kuusaa', 'Doctors': 'Doktoroota',
    'Reports': 'Gabaasota', 'Security Center': 'Giddugala Nageenyaa', 'Backup & Restore': 'Kuusuu fi Deebisuu',
    'Settings': 'Qindaa’inoota', 'Sign out': 'Ba’i', 'Main Menu': 'Baafata Guddaa', 'Account': 'Herrega',
    'Clinic workspace': 'Iddoo hojii kilinikaa', 'Home': 'Mana', 'Live Alerts': 'Beeksisa Yeroo Ammaa',
    'Mark read': 'Dubbifame godhi', 'Clear all': 'Hunda haqi', 'No active notifications for': 'Beeksisni hojii irra jiru hin jiru:',
    'View All Notifications': 'Beeksisa Hunda Ilaali', 'Maintenance mode is on': 'Haalli suphaa hojii irra jira',
    'Clinical staff are paused. You still have administrator access.': 'Hojjettoonni kilinikaa yeroo ammaa dhaabbataniiru. Hayyama bulchaa qabdu.',
    'Manage': 'Bulchi', 'Clinic data could not be refreshed': 'Odeeffannoon kilinikaa haaromfamuu hin dandeenye',
    'Loading clinic data…': 'Odeeffannoo kilinikaa fe’aa…', 'Session Locked': 'Seessi cufameera',
    'This workstation was locked after inactivity. Enter your account password to resume your session.': 'Kompiitarri kun yeroo hin fayyadamneef cufameera. Itti fufuuf jecha darbii herrega kee galchi.',
    'Account Password': 'Jecha darbii herregaa', 'Enter password to unlock...': 'Cufiinsa banuuf jecha darbii galchi…',
    'Unlocking…': 'Banaa jira…', 'Unlock Workstation': 'Kompiitara hojii bani', 'Stay signed in': 'Seenee turi',
    'Sign out of BruClinic?': 'BruClinic keessaa ba’uu barbaaddaa?', 'You will need to sign in again.': 'Ammas seenuun si barbaachisa.',
    'English': 'Afaan Ingiliffaa', 'Language': 'Afaan', 'Choose the language for this device.': 'Afaan meeshaa kanaa filadhu.',
    'Appearance': 'Bifa', 'Choose the theme for this device.': 'Bifa meeshaa kanaa filadhu.',
    'Dark mode': 'Haala dukkanaa', 'Light mode': 'Haala ifaa', 'Light': 'Ifaa', 'Dark': 'Dukkana',
    'Bright clinic workspace': 'Iddoo hojii kilinikaa ifaa', 'Low-glare workspace': 'Iddoo hojii ifni isaa hin rakkisne',
    'Your account': 'Herrega kee', 'Signed-in staff profile from the database.': 'Piroofaayila hojjetaa seenee jiru kuusaa odeeffannoo irraa.',
    'Username': 'Maqaa fayyadamaa', 'Email': 'Imeelii', 'Phone': 'Bilbila', 'Gender': 'Saala', 'Department': 'Kutaa',
    'Personal preferences.': 'Filannoo dhuunfaa.', 'Add profile picture': 'Suuraa piroofaayila dabali',
    'Change picture': 'Suuraa jijjiiri', 'Remove': 'Haqi', 'Saving…': 'Olkaa’aa jira…',
    'Profile picture updated.': 'Suuraan piroofaayilaa haaromfameera.', 'Profile picture removed.': 'Suuraan piroofaayilaa haqameera.',
    'Could not load default password status.': 'Haala jecha darbii durtii fe’uun hin danda’amne.',
    'Could not update the default password.': 'Jecha darbii durtii haaromsuun hin danda’amne.',
    'Please choose an image file.': 'Faayila suuraa filadhu.', 'Could not prepare that image.': 'Suuraa qopheessuun hin danda’amne.',
    'That image is too large. Please choose a smaller photo.': 'Suuraan sun baay’ee guddaadha. Suuraa xiqqaa filadhu.',
    'That image could not be read.': 'Suuraa sana dubbisuun hin danda’amne.',
    'Sign In': 'Seeni', 'Enter your clinic credentials to access your clinical dashboard.': 'Daashboordii kilinikaa seenuuf odeeffannoo seensaa galchi.',
    'Username / Staff ID': 'Maqaa fayyadamaa / ID hojjetaa', 'Password': 'Jecha darbii', 'Authenticating…': 'Mirkaneessaa jira…',
    'Switch to': 'Gara', 'mode': 'haalaatti', 'Toggle theme': 'Bifa jijjiiri', 'Switch to light mode': 'Gara haala ifaatti jijjiiri',
    'Switch to dark mode': 'Gara haala dukkanaatti jijjiiri', 'theme active': 'bifa hojii irra jiru', 'Light Mode': 'Haala Ifaa',
    'Dark Mode': 'Haala Dukkanaa', 'Hide password': 'Jecha darbii dhoksi', 'Show password': 'Jecha darbii agarsiisi',
    'Hide default password': 'Jecha darbii durtii dhoksi', 'Show default password': 'Jecha darbii durtii agarsiisi',
    'Clear and delete all active alerts': 'Beeksisota hojii irra jiran hunda qulqulleessi fi haqi', 'Dismiss notification': 'Beeksisa cufi',
    'Clinic': 'Kilinika', 'Your profile': 'Piroofaayila kee',
    'Administrator': 'Bulchaa', 'Receptionist': 'Hojjetaa simannaa', 'OPD Physician': 'Doktora OPD',
    'Emergency Specialist': 'Ogeessa hatattamaa', 'Pharmacist': 'Ogeessa qorichaa', 'Lab Technologist': 'Ogeessa laaboraatoorii',
    'Clinic staff': 'Hojjetaa kilinikaa', 'Administration': 'Bulchiinsa', 'Admissions & Records': 'Galmee fi fudhannaa',
    'Outpatient (OPD)': 'Dhukkubsataa alaa (OPD)', 'Emergency (ER)': 'Hatattamaa (ER)', 'Pharmacy': 'Farmaasii', 'Laboratory': 'Laaboraatoorii',
    'Username is required.': 'Maqaan fayyadamaa barbaachisa.', 'Password is required.': 'Jecha darbii barbaachisa.',
    'Username must be at least 3 characters.': 'Maqaan fayyadamaa yoo xiqqaate qubee 3 qabaachuu qaba.',
    'Username must not exceed 60 characters.': 'Maqaan fayyadamaa qubee 60 caaluu hin qabu.',
    'Current password': 'Jecha darbii amma jiru', 'New password': 'Jecha darbii haaraa', 'Confirm password': 'Jecha darbii mirkaneessi',
    'Confirm new password': 'Jecha darbii haaraa mirkaneessi', 'Change your temporary password': 'Jecha darbii yeroo muraasaa jijjiiri',
    'Change password': 'Jecha darbii jijjiiri', 'A password change is required before you can continue.': 'Itti fufuuf jecha darbii jijjiiruun dirqama.',
    'Enter your current password and choose a new one.': 'Jecha darbii amma jiru galchi; isa haaraas filadhu.',
    'The new passwords do not match.': 'Jechoonni darbii haaraan wal hin simu.', 'Unable to change password.': 'Jecha darbii jijjiiruun hin danda’amne.',
    'Password changed successfully.': 'Jecha darbii milkaa’inaan jijjiirameera.', 'Updating…': 'Haaromsaa jira…', 'Update password': 'Jecha darbii haaromsi',
    'New password must be between 10 and 128 characters.': 'Jecha darbii haaraan qubee 10 hanga 128 qabaachuu qaba.',
    'New password must contain uppercase, lowercase letters, and at least one number.': 'Jecha darbii haaraan qubee gurguddaa, qubee xixiqqaa fi yoo xiqqaate lakkoofsa tokko qabaachuu qaba.',
    'Default staff password': 'Jecha darbii durtii hojjetaa', 'New staff accounts use this temporary password and must change it at first sign-in.': 'Herregni hojjetaa haaraan jecha darbii yeroo muraasaa kana fayyadama; yeroo jalqaba seenu jijjiiruu qaba.',
    'Current default password': 'Jecha darbii durtii amma jiru', 'A default password is configured but was saved before it could be displayed here. Save a new one below to see it.': 'Jecha darbii durtii qindaa’eera, garuu asitti agarsiisuu dura kuufame. Arguuf asii gaditti haaraa kuusi.',
    'No default password is set. New staff accounts will not be able to sign in until one is configured.': 'Jecha darbii durtii hin qindaa’in. Hanga qindaa’utti hojjettoonni haaraan seenuu hin danda’an.',
    'New default password': 'Jecha darbii durtii haaraa', 'Save default password': 'Jecha darbii durtii kuusi',
    'Shared clinic information.': 'Odeeffannoo kilinikaa waliinii.', 'Facility': 'Dhaabbata', 'Location': 'Iddoo', 'Database': 'Kuusaa odeeffannoo', 'Connected through API': 'API’n walitti hidhameera',
    'Scheduled maintenance': 'Suphaa karoorfame', 'We’ll be back shortly': 'Yeroo gabaabaa booda ni deebina', 'Checking…': 'Mirkaneessaa jira…', 'Check again': 'Ammas ilaali',
    'Administrator sign in': 'Seensa bulchaa', 'Patient records are safe. Clinical activity is paused until maintenance ends.': 'Galmeen dhukkubsattootaa nageenya keessa jira. Hojii kilinikaa hanga suphaan xumuramutti dhaabbateera.',
    'Last checked at': 'Yeroo dhumaa ilaalame:', 'Checks automatically every 30 seconds': 'Ofumaan sekondii 30 hunda ilaala', 'Urgent clinical need? Call reception on': 'Haala fayyaa ariifachiisaa? Bilbila simannaa irratti bilbili',
    'Administration workspace': 'Iddoo hojii bulchiinsaa', 'Clinic patients, appointments, medical records, and pharmacy inventory.': 'Dhukkubsattoota, beellamoota, galmee fayyaa fi kuusaa farmaasii kilinikaa.',
    'Reception workspace': 'Iddoo hojii simannaa', 'Keep patient registration and OPD requests moving quickly.': 'Galmeessa dhukkubsattootaa fi gaaffii OPD saffisaan raawwadhu.',
    'OPD workspace': 'Iddoo hojii OPD', 'Focus on consultations, referrals, and patient records.': 'Mariin fayyaa, ergaa gara kutaa biraatti fi galmee dhukkubsattootaa irratti xiyyeeffadhu.',
    'Emergency workspace': 'Iddoo hojii hatattamaa', 'Keep triage and urgent patient movement visible.': 'Triage fi sochii dhukkubsattoota hatattamaa hordofi.',
    'Pharmacy workspace': 'Iddoo hojii farmaasii', 'Process prescriptions and monitor dispensary stock.': 'Ajaja qorichaa raawwadhu; qoricha kuusaa hordofi.',
    'Laboratory workspace': 'Iddoo hojii laaboraatoorii', 'Track diagnostic work and release verified results.': 'Hojii qorannoo hordofi; bu’aa mirkanaa’e baasi.',
    'Patient cards': 'Kaardii dhukkubsataa', 'OPD requests': 'Gaaffii OPD', 'Medical records': 'Galmee fayyaa',
    'Pharmacy & inventory': 'Farmaasii fi kuusaa', 'Consultation queue': 'Tarree marii fayyaa', 'Emergency queue': 'Tarree hatattamaa',
    'Prescription queue': 'Tarree ajaja qorichaa', 'Inventory': 'Kuusaa', 'Laboratory queue': 'Tarree laaboraatoorii',
    'Invalid credentials. Please verify username and password.': 'Odeeffannoo seensaa sirrii miti. Maqaa fayyadamaa fi jecha darbii mirkaneessi.',
    'Could not connect to the authentication service. Please try again.': 'Tajaajila seensaa waliin wal qunnamuun hin danda’amne. Irra deebi’i.',
    'Offline. Changes are paused until the connection returns.': 'Intarneetiin hin jiru. Walitti dhufeenyi hamma deebi’utti jijjiiramni dhaabbateera.',
    'Back online': 'Walitti dhufeenyi deebi’eera',
    'Connection restored. You are back online.': 'Walitti dhufeenyi deebi’eera. Amma toora irra jirta.',
  },
  am: {
    'Dashboard': 'ዳሽቦርድ', 'Staff Accounts': 'የሠራተኞች መለያዎች', 'Patients': 'ታካሚዎች',
    'Appointments': 'ቀጠሮዎች', 'Medical Records': 'የሕክምና መዝገቦች', 'Messages': 'መልዕክቶች',
    'Notifications': 'ማሳወቂያዎች', 'Pharmacy & Inventory': 'ፋርማሲ እና ክምችት', 'Doctors': 'ሐኪሞች',
    'Reports': 'ሪፖርቶች', 'Security Center': 'የደህንነት ማዕከል', 'Backup & Restore': 'ምትኬ እና መመለስ',
    'Settings': 'ቅንብሮች', 'Sign out': 'ውጣ', 'Main Menu': 'ዋና ምናሌ', 'Account': 'መለያ',
    'Clinic workspace': 'የክሊኒክ የሥራ ቦታ', 'Home': 'መነሻ', 'Live Alerts': 'የቀጥታ ማሳወቂያዎች',
    'Mark read': 'እንደተነበበ ምልክት አድርግ', 'Clear all': 'ሁሉንም አጽዳ',
    'No active notifications for': 'ንቁ ማሳወቂያዎች የሉም፦', 'View All Notifications': 'ሁሉንም ማሳወቂያዎች ይመልከቱ',
    'Maintenance mode is on': 'የጥገና ሁነታ በርቷል',
    'Clinical staff are paused. You still have administrator access.': 'የክሊኒክ ሠራተኞች ሥራ ለጊዜው ቆሟል። የአስተዳዳሪ መዳረሻዎ አለ።',
    'Manage': 'አስተዳድር', 'Clinic data could not be refreshed': 'የክሊኒኩን መረጃ ማደስ አልተቻለም',
    'Loading clinic data…': 'የክሊኒክ መረጃ በመጫን ላይ…', 'Session Locked': 'ክፍለ ጊዜው ተቆልፏል',
    'This workstation was locked after inactivity. Enter your account password to resume your session.': 'ይህ የሥራ መሣሪያ ከጥቅም ውጭ ከቆየ በኋላ ተቆልፏል። ለመቀጠል የመለያዎን ይለፍ ቃል ያስገቡ።',
    'Account Password': 'የመለያ ይለፍ ቃል', 'Enter password to unlock...': 'ለመክፈት ይለፍ ቃል ያስገቡ…',
    'Unlocking…': 'በመክፈት ላይ…', 'Unlock Workstation': 'የሥራ መሣሪያውን ክፈት', 'Stay signed in': 'ግባ ብለው ይቆዩ',
    'Sign out of BruClinic?': 'ከBruClinic መውጣት ይፈልጋሉ?', 'You will need to sign in again.': 'እንደገና መግባት ያስፈልግዎታል።',
    'English': 'እንግሊዝኛ', 'Language': 'ቋንቋ', 'Choose the language for this device.': 'ለዚህ መሣሪያ ቋንቋ ይምረጡ።',
    'Appearance': 'መልክ', 'Choose the theme for this device.': 'ለዚህ መሣሪያ ገጽታ ይምረጡ።',
    'Dark mode': 'ጨለማ ሁነታ', 'Light mode': 'ብርሃን ሁነታ', 'Light': 'ብርሃን', 'Dark': 'ጨለማ',
    'Bright clinic workspace': 'ብሩህ የክሊኒክ የሥራ ቦታ', 'Low-glare workspace': 'ዓይንን የማያደክም የሥራ ቦታ',
    'Your account': 'የእርስዎ መለያ', 'Signed-in staff profile from the database.': 'ከዳታቤዝ የተገኘ የገቡት ሠራተኛ መገለጫ።',
    'Username': 'የተጠቃሚ ስም', 'Email': 'ኢሜይል', 'Phone': 'ስልክ', 'Gender': 'ጾታ', 'Department': 'ክፍል',
    'Personal preferences.': 'የግል ምርጫዎች።', 'Add profile picture': 'የመገለጫ ፎቶ ጨምር',
    'Change picture': 'ፎቶ ቀይር', 'Remove': 'አስወግድ', 'Saving…': 'በማስቀመጥ ላይ…',
    'Profile picture updated.': 'የመገለጫ ፎቶው ተዘምኗል።', 'Profile picture removed.': 'የመገለጫ ፎቶው ተወግዷል።',
    'Could not load default password status.': 'የነባሪ ይለፍ ቃል ሁኔታን መጫን አልተቻለም።',
    'Could not update the default password.': 'ነባሪውን ይለፍ ቃል ማዘመን አልተቻለም።',
    'Please choose an image file.': 'እባክዎ የምስል ፋይል ይምረጡ።', 'Could not prepare that image.': 'ያንን ምስል ማዘጋጀት አልተቻለም።',
    'That image is too large. Please choose a smaller photo.': 'ምስሉ በጣም ትልቅ ነው። እባክዎ ትንሽ ፎቶ ይምረጡ።',
    'That image could not be read.': 'ያንን ምስል ማንበብ አልተቻለም።',
    'Sign In': 'ግባ', 'Enter your clinic credentials to access your clinical dashboard.': 'የክሊኒክ ዳሽቦርድዎን ለመጠቀም የመግቢያ መረጃዎን ያስገቡ።',
    'Username / Staff ID': 'የተጠቃሚ ስም / የሠራተኛ መለያ', 'Password': 'ይለፍ ቃል', 'Authenticating…': 'በማረጋገጥ ላይ…',
    'Switch to': 'ወደ', 'mode': 'ሁነታ', 'Toggle theme': 'ገጽታ ቀይር', 'Switch to light mode': 'ወደ ብርሃን ሁነታ ቀይር',
    'Switch to dark mode': 'ወደ ጨለማ ሁነታ ቀይር', 'theme active': 'ገጽታ ንቁ ነው', 'Light Mode': 'ብርሃን ሁነታ',
    'Dark Mode': 'ጨለማ ሁነታ', 'Hide password': 'ይለፍ ቃል ደብቅ', 'Show password': 'ይለፍ ቃል አሳይ',
    'Hide default password': 'ነባሪ ይለፍ ቃል ደብቅ', 'Show default password': 'ነባሪ ይለፍ ቃል አሳይ',
    'Clear and delete all active alerts': 'ሁሉንም ንቁ ማሳወቂያዎች አጽዳ እና ሰርዝ', 'Dismiss notification': 'ማሳወቂያውን ዝጋ',
    'Clinic': 'ክሊኒክ', 'Your profile': 'የእርስዎ መገለጫ',
    'Administrator': 'አስተዳዳሪ', 'Receptionist': 'የመቀበያ ሠራተኛ', 'OPD Physician': 'የOPD ሐኪም',
    'Emergency Specialist': 'የድንገተኛ ሕክምና ባለሙያ', 'Pharmacist': 'ፋርማሲስት', 'Lab Technologist': 'የላቦራቶሪ ባለሙያ',
    'Clinic staff': 'የክሊኒክ ሠራተኛ', 'Administration': 'አስተዳደር', 'Admissions & Records': 'ተቀባይነት እና መዝገቦች',
    'Outpatient (OPD)': 'የውጭ ታካሚዎች (OPD)', 'Emergency (ER)': 'ድንገተኛ (ER)', 'Pharmacy': 'ፋርማሲ', 'Laboratory': 'ላቦራቶሪ',
    'Username is required.': 'የተጠቃሚ ስም ያስፈልጋል።', 'Password is required.': 'ይለፍ ቃል ያስፈልጋል።',
    'Username must be at least 3 characters.': 'የተጠቃሚ ስም ቢያንስ 3 ቁምፊዎች ሊኖሩት ይገባል።',
    'Username must not exceed 60 characters.': 'የተጠቃሚ ስም ከ60 ቁምፊዎች መብለጥ የለበትም።',
    'Current password': 'የአሁኑ ይለፍ ቃል', 'New password': 'አዲስ ይለፍ ቃል', 'Confirm password': 'ይለፍ ቃሉን ያረጋግጡ',
    'Confirm new password': 'አዲሱን ይለፍ ቃል ያረጋግጡ', 'Change your temporary password': 'ጊዜያዊ ይለፍ ቃልዎን ይቀይሩ',
    'Change password': 'ይለፍ ቃል ቀይር', 'A password change is required before you can continue.': 'ከመቀጠልዎ በፊት ይለፍ ቃሉን መቀየር ያስፈልጋል።',
    'Enter your current password and choose a new one.': 'የአሁኑን ይለፍ ቃል ያስገቡ እና አዲስ ይምረጡ።',
    'The new passwords do not match.': 'አዲሶቹ ይለፍ ቃሎች አይዛመዱም።', 'Unable to change password.': 'ይለፍ ቃሉን መቀየር አልተቻለም።',
    'Password changed successfully.': 'ይለፍ ቃሉ በተሳካ ሁኔታ ተቀይሯል።', 'Updating…': 'በማዘመን ላይ…', 'Update password': 'ይለፍ ቃል አዘምን',
    'New password must be between 10 and 128 characters.': 'አዲሱ ይለፍ ቃል ከ10 እስከ 128 ቁምፊዎች ሊኖሩት ይገባል።',
    'New password must contain uppercase, lowercase letters, and at least one number.': 'አዲሱ ይለፍ ቃል ትልቅ ፊደል፣ ትንሽ ፊደል እና ቢያንስ አንድ ቁጥር ሊኖረው ይገባል።',
    'Default staff password': 'ነባሪ የሠራተኛ ይለፍ ቃል', 'New staff accounts use this temporary password and must change it at first sign-in.': 'አዲስ የሠራተኛ መለያዎች ይህን ጊዜያዊ ይለፍ ቃል ይጠቀማሉ እና በመጀመሪያ ግቤት መቀየር አለባቸው።',
    'Current default password': 'የአሁኑ ነባሪ ይለፍ ቃል', 'A default password is configured but was saved before it could be displayed here. Save a new one below to see it.': 'ነባሪ ይለፍ ቃል ተዘጋጅቷል፣ ግን እዚህ ከመታየቱ በፊት ተቀምጧል። ለማየት ከታች አዲስ ያስቀምጡ።',
    'No default password is set. New staff accounts will not be able to sign in until one is configured.': 'ነባሪ ይለፍ ቃል አልተዘጋጀም። እስኪዘጋጅ ድረስ አዲስ ሠራተኞች መግባት አይችሉም።',
    'New default password': 'አዲስ ነባሪ ይለፍ ቃል', 'Save default password': 'ነባሪ ይለፍ ቃል አስቀምጥ',
    'Shared clinic information.': 'የጋራ የክሊኒክ መረጃ።', 'Facility': 'ተቋም', 'Location': 'አካባቢ', 'Database': 'ዳታቤዝ', 'Connected through API': 'በAPI ተገናኝቷል',
    'Scheduled maintenance': 'የታቀደ ጥገና', 'We’ll be back shortly': 'በቅርቡ እንመለሳለን', 'Checking…': 'በመፈተሽ ላይ…', 'Check again': 'እንደገና ይፈትሹ',
    'Administrator sign in': 'የአስተዳዳሪ መግቢያ', 'Patient records are safe. Clinical activity is paused until maintenance ends.': 'የታካሚ መዝገቦች ደህና ናቸው። ጥገናው እስኪያበቃ የክሊኒክ ሥራ ቆሟል።',
    'Last checked at': 'መጨረሻ የተፈተሸበት ሰዓት፦', 'Checks automatically every 30 seconds': 'በየ30 ሰከንዱ በራስ-ሰር ይፈትሻል', 'Urgent clinical need? Call reception on': 'አስቸኳይ የሕክምና እርዳታ ይፈልጋሉ? መቀበያውን በዚህ ቁጥር ይደውሉ',
    'Administration workspace': 'የአስተዳደር የሥራ ቦታ', 'Clinic patients, appointments, medical records, and pharmacy inventory.': 'የክሊኒኩ ታካሚዎች፣ ቀጠሮዎች፣ የሕክምና መዝገቦች እና የፋርማሲ ክምችት።',
    'Reception workspace': 'የመቀበያ የሥራ ቦታ', 'Keep patient registration and OPD requests moving quickly.': 'የታካሚ ምዝገባን እና የOPD ጥያቄዎችን በፍጥነት ያስኬዱ።',
    'OPD workspace': 'የOPD የሥራ ቦታ', 'Focus on consultations, referrals, and patient records.': 'በምክክር፣ በሪፈራል እና በታካሚ መዝገቦች ላይ ያተኩሩ።',
    'Emergency workspace': 'የድንገተኛ የሥራ ቦታ', 'Keep triage and urgent patient movement visible.': 'ትራያጅን እና አስቸኳይ የታካሚ እንቅስቃሴን ይከታተሉ።',
    'Pharmacy workspace': 'የፋርማሲ የሥራ ቦታ', 'Process prescriptions and monitor dispensary stock.': 'የመድኃኒት ትእዛዞችን ያስኬዱ እና የፋርማሲ ክምችትን ይከታተሉ።',
    'Laboratory workspace': 'የላቦራቶሪ የሥራ ቦታ', 'Track diagnostic work and release verified results.': 'የምርመራ ሥራን ይከታተሉ እና የተረጋገጡ ውጤቶችን ያውጡ።',
    'Patient cards': 'የታካሚ ካርዶች', 'OPD requests': 'የOPD ጥያቄዎች', 'Medical records': 'የሕክምና መዝገቦች',
    'Pharmacy & inventory': 'ፋርማሲ እና ክምችት', 'Consultation queue': 'የምክክር ወረፋ', 'Emergency queue': 'የድንገተኛ ወረፋ',
    'Prescription queue': 'የመድኃኒት ትእዛዝ ወረፋ', 'Inventory': 'ክምችት', 'Laboratory queue': 'የላቦራቶሪ ወረፋ',
    'Invalid credentials. Please verify username and password.': 'የመግቢያ መረጃው ትክክል አይደለም። የተጠቃሚ ስምና ይለፍ ቃል ያረጋግጡ።',
    'Could not connect to the authentication service. Please try again.': 'ከመግቢያ አገልግሎቱ ጋር መገናኘት አልተቻለም። እንደገና ይሞክሩ።',
    'Offline. Changes are paused until the connection returns.': 'ከመስመር ውጭ ነዎት። ግንኙነቱ እስኪመለስ ለውጦች ቆመዋል።',
    'Back online': 'ግንኙነቱ ተመልሷል', 'Connection restored. You are back online.': 'ግንኙነቱ ተመልሷል። እንደገና መስመር ላይ ነዎት።',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (englishText: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const LANGUAGE_STORAGE_KEY = 'bruclinic-language';

function getSavedLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return saved === 'om' || saved === 'am' ? saved : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getSavedLanguage);

  useEffect(() => {
    const htmlLanguage = language === 'om' ? 'om' : language === 'am' ? 'am' : 'en';
    document.documentElement.lang = htmlLanguage;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const value = useMemo<LanguageContextType>(() => ({
    language,
    setLanguage,
    t: (englishText: string) => language === 'en' ? englishText : translations[language][englishText] || englishText,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
