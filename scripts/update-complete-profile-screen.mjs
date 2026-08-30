import fs from 'node:fs';

const completeProfileScreenPath = 'C:/Users/SIMPATY SOLUTIONS/ChurchEden-Mobile/src/screens/CompleteProfileScreen.tsx';
let screenCode = fs.readFileSync(completeProfileScreenPath, 'utf8');

// Replace handleSubmit in CompleteProfileScreen.tsx to call submitCompleteProfile and requestToJoinChurch
const oldSubmitRegex = /const handleSubmit = async \(\) => \{[\s\S]*?finally \{\s*setIsSubmitting\(false\);\s*\}\s*\};/;

const newSubmitCode = `const handleSubmit = async () => {
    Keyboard.dismiss();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      return;
    }
    setIsSubmitting(true);
    try {
      // 1. Submit complete profile to backend
      const profileRes = await profileService.submitCompleteProfile({
        fullName: form.fullName,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        phoneNumber: form.phone,
        contactEmail: form.email,
        city: form.city,
        address: form.fullAddress || form.city,
        maritalStatus: form.maritalStatus,
        occupation: form.occupation,
        photoUri: form.photoUri,
      });

      if (!profileRes.success && profileRes.error?.includes('already')) {
        // Continue if profile was already created
      }

      // 2. Submit join request to backend
      const response = await churchService.requestToJoinChurch(churchId);
      if (response.success) {
        await saveProfileDraft(churchId, { ...form, churchId });
        await setSelectedChurchId(churchId);
        router.replace({
          pathname: '/pending-approval',
          params: { churchId },
        });
      } else {
        alert(response.error || 'Failed to send your request.');
      }
    } catch (err) {
      alert('Network error while sending your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };`;

screenCode = screenCode.replace(oldSubmitRegex, newSubmitCode);

// Ensure profileService is imported
if (!screenCode.includes('profileService')) {
  screenCode = screenCode.replace(
    "import churchService from '../services/churchService';",
    "import churchService from '../services/churchService';\nimport profileService from '../services/profileService';"
  );
}

fs.writeFileSync(completeProfileScreenPath, screenCode, 'utf8');
console.log('Successfully updated CompleteProfileScreen.tsx');
