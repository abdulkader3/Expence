export const validateRegistration = (data) => {
  const errors = [];

  if (!data.name || typeof data.name !== "string") {
    errors.push({ field: "name", message: "Name is required" });
  } else if (data.name.trim().length < 2) {
    errors.push({
      field: "name",
      message: "Name must be at least 2 characters",
    });
  } else if (data.name.trim().length > 100) {
    errors.push({
      field: "name",
      message: "Name cannot exceed 100 characters",
    });
  }

  if (!data.email || typeof data.email !== "string") {
    errors.push({ field: "email", message: "Email is required" });
  } else if (!/^\S+@\S+\.\S+$/.test(data.email)) {
    errors.push({ field: "email", message: "Please provide a valid email" });
  }

  if (!data.password || typeof data.password !== "string") {
    errors.push({ field: "password", message: "Password is required" });
  } else if (data.password.length < 8) {
    errors.push({
      field: "password",
      message: "Password must be at least 8 characters",
    });
  }

  if (data.phone && typeof data.phone !== "string") {
    errors.push({ field: "phone", message: "Phone must be a string" });
  }

  if (data.company && typeof data.company !== "string") {
    errors.push({ field: "company", message: "Company must be a string" });
  }

  return errors;
};

export const validateLogin = (data) => {
  const errors = [];

  if (!data.email || typeof data.email !== "string") {
    errors.push({ field: "email", message: "Email is required" });
  } else if (!/^\S+@\S+\.\S+$/.test(data.email)) {
    errors.push({ field: "email", message: "Please provide a valid email" });
  }

  if (!data.password || typeof data.password !== "string") {
    errors.push({ field: "password", message: "Password is required" });
  }

  return errors;
};
