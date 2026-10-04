package com.devsheddy.minipay.services;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.NoSuchElementException;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.devsheddy.minipay.models.User;
import com.devsheddy.minipay.models.Wallet;
import com.devsheddy.minipay.repositories.UserRepository;
import com.devsheddy.minipay.repositories.WalletRepository;

@Service
public class WalletService {

    // Matches the balance column: DECIMAL(19, 2).
    private static final BigDecimal MAX_BALANCE =
            new BigDecimal("99999999999999999.99");

    private final WalletRepository walletRepository;
    private final UserRepository userRepository;

    public WalletService(
            WalletRepository walletRepository,
            UserRepository userRepository) {

        this.walletRepository = walletRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public WalletSummary createWallet(Long userId) {
        requirePositiveId(userId, "User ID");

        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new NoSuchElementException("User not found: " + userId));

        if (walletRepository.existsByUser_Id(userId)) {
            throw new IllegalStateException("This user already has a wallet.");
        }

        Wallet wallet = new Wallet(user);
        Wallet savedWallet = walletRepository.save(wallet);

        return toSummary(savedWallet);
    }

    @Transactional(readOnly = true)
    public WalletSummary getWalletById(Long walletId) {
        return toSummary(findWallet(walletId));
    }

    @Transactional(readOnly = true)
    public WalletSummary getWalletByUserId(Long userId) {
        requirePositiveId(userId, "User ID");

        Wallet wallet = walletRepository.findByUser_Id(userId)
                .orElseThrow(() ->
                        new NoSuchElementException(
                                "Wallet not found for user: " + userId));

        return toSummary(wallet);
    }

    @Transactional
    public WalletSummary topUpWallet(Long walletId, BigDecimal amount) {
        BigDecimal validAmount = validateAmount(amount);
        Wallet wallet = findWallet(walletId);

        BigDecimal updatedBalance = wallet.getBalance().add(validAmount);

        if (updatedBalance.compareTo(MAX_BALANCE) > 0) {
            throw new IllegalArgumentException(
                    "Top-up would exceed the maximum wallet balance.");
        }

        wallet.setBalance(updatedBalance);
        Wallet savedWallet = walletRepository.save(wallet);

        return toSummary(savedWallet);
    }

    private Wallet findWallet(Long walletId) {
        requirePositiveId(walletId, "Wallet ID");

        return walletRepository.findById(walletId)
                .orElseThrow(() ->
                        new NoSuchElementException(
                                "Wallet not found: " + walletId));
    }

    private void requirePositiveId(Long id, String field) {
        if (id == null || id <= 0) {
            throw new IllegalArgumentException(field + " must be positive.");
        }
    }

    private BigDecimal validateAmount(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Top-up amount must be greater than zero.");
        }

        if (amount.compareTo(MAX_BALANCE) > 0) {
            throw new IllegalArgumentException("Top-up amount is too large.");
        }

        try {
            return amount.setScale(2, RoundingMode.UNNECESSARY);
        } catch (ArithmeticException exception) {
            throw new IllegalArgumentException(
                    "Amount must use whole cents, for example 100.50.",
                    exception);
        }
    }

    private WalletSummary toSummary(Wallet wallet) {
        return new WalletSummary(
                wallet.getId(),
                wallet.getUser().getId(),
                wallet.getBalance(),
                wallet.getCurrency()
        );
    }

    public record WalletSummary(
            Long id,
            Long userId,
            BigDecimal balance,
            String currency
    ) {}
}