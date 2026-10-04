package com.devsheddy.minipay.services;

import java.util.List;
import java.util.Locale;
import java.util.NoSuchElementException;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.devsheddy.minipay.models.User;
import com.devsheddy.minipay.repositories.UserRepository;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional
    public User createUser(String fullName, String email) {
        String name = requiredText(fullName, "Full name", 100);
        String normalizedEmail =
                requiredText(email, "Email", 150).toLowerCase(Locale.ROOT);

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalStateException("Email is already registered.");
        }

        User user = new User(name, normalizedEmail);

        return userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @Transactional(readOnly = true)
    public User getUserById(Long id) {
        if (id == null || id <= 0) {
            throw new IllegalArgumentException("User ID must be positive.");
        }

        return userRepository.findById(id)
                .orElseThrow(() ->
                        new NoSuchElementException("User not found: " + id));
    }

    private String requiredText(String value, String field, int maxLength) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required.");
        }

        String cleaned = value.strip();

        if (cleaned.length() > maxLength) {
            throw new IllegalArgumentException(
                    field + " must not exceed " + maxLength + " characters.");
        }

        return cleaned;
    }
}