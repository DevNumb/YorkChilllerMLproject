import { supabase } from './supabaseClient';

/**
 * Register a new user
 */
export async function registerUser(email, password, fullName) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) throw error;

    console.log('[Auth] User registered successfully:', data.user.id);
    return { user: data.user, session: data.session };
  } catch (err) {
    console.error('[Auth] Registration failed:', err.message);
    throw err;
  }
}

/**
 * Login user
 */
export async function loginUser(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    console.log('[Auth] User logged in successfully:', data.user.id);

    // Log the login action
    await logUserAction('login', 'auth', 'login');

    return { user: data.user, session: data.session };
  } catch (err) {
    console.error('[Auth] Login failed:', err.message);
    throw err;
  }
}

/**
 * Logout user
 */
export async function logoutUser() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    console.log('[Auth] User logged out successfully');
    return true;
  } catch (err) {
    console.error('[Auth] Logout failed:', err.message);
    throw err;
  }
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  } catch (err) {
    console.error('[Auth] Failed to get current user:', err.message);
    return null;
  }
}

/**
 * Get current session
 */
export async function getCurrentSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (err) {
    console.error('[Auth] Failed to get session:', err.message);
    return null;
  }
}

/**
 * Get user profile
 */
export async function getUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Auth] Failed to get user profile:', err.message);
    return null;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId, updates) {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    console.log('[Auth] User profile updated successfully');
    return data;
  } catch (err) {
    console.error('[Auth] Failed to update profile:', err.message);
    throw err;
  }
}

/**
 * Reset password
 */
export async function resetPassword(email) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;

    console.log('[Auth] Password reset email sent');
    return true;
  } catch (err) {
    console.error('[Auth] Failed to send reset email:', err.message);
    throw err;
  }
}

/**
 * Update password
 */
export async function updatePassword(newPassword) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;

    console.log('[Auth] Password updated successfully');
    return true;
  } catch (err) {
    console.error('[Auth] Failed to update password:', err.message);
    throw err;
  }
}

/**
 * Log user action
 */
export async function logUserAction(action, resourceType = null, resourceId = null, details = null) {
  try {
    const { error } = await supabase.rpc('log_user_action', {
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_details: details,
    });

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Auth] Failed to log action:', err.message);
    return false;
  }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return data.subscription;
}
