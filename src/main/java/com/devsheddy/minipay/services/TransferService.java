package com.devsheddy.minipay.services;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.devsheddy.minipay.models.Transfer;
import com.devsheddy.minipay.models.Wallet;
import com.devsheddy.minipay.repositories.TransferRepository;
import com.devsheddy.minipay.repositories.WalletRepository;

@Service
public class TransferService {

    private static final BigDecimal MAX_BALANCE =
            new BigDecimal("99999999999999999.99");

    private final WalletRepository walletRepository;
    private final TransferRepository transferRepository;

    public TransferService(
            WalletRepository walletRepository,
            TransferRepository transferRepository) {

        this.walletRepository = walletRepository;
        this.transferRepository = transferRepository;
    }

    @Transactional
    public TransferSummary createTransfer(
            Long senderWalletId,
            Long receiverWalletId,
            BigDecimal amount) {

        requirePositiveId(senderWalletId, "Sender wallet ID");
        requirePositiveId(receiverWalletId, "Receiver wallet ID");

        if (senderWalletId.equals(receiverWalletId)) {
            throw new IllegalArgumentException(
                    "Sender and receiver must be different wallets.");
        }

        BigDecimal validAmount = validateAmount(amount);
        Wallet sender = findWallet(senderWalletId);
        Wallet receiver = findWallet(receiverWalletId);

        if (!sender.getCurrency().equals(receiver.getCurrency())) {
            throw new IllegalArgumentException(
                    "Both wallets must use the same currency.");
        }

        if (sender.getBalance().compareTo(validAmount) < 0) {
            throw new IllegalStateException("Insufficient wallet balance.");
        }

        BigDecimal receiverBalance = receiver.getBalance().add(validAmount);

        if (receiverBalance.compareTo(MAX_BALANCE) > 0) {
            throw new IllegalArgumentException(
                    "Transfer would exceed the receiver's maximum balance.");
        }

        sender.setBalance(sender.getBalance().subtract(validAmount));
        receiver.setBalance(receiverBalance);

        walletRepository.save(sender);
        walletRepository.save(receiver);

        // Execute updates and version checks inside the same transaction.
        // A flush executes SQL; it does not commit the transaction.
        walletRepository.flush();

        Transfer transfer = new Transfer(sender, receiver, validAmount);
        Transfer savedTransfer = transferRepository.saveAndFlush(transfer);

        return toSummary(savedTransfer);
    }

    @Transactional(readOnly = true)
    public TransferSummary getTransferById(Long transferId) {
        requirePositiveId(transferId, "Transfer ID");

        Transfer transfer = transferRepository.findById(transferId)
                .orElseThrow(() -> new NoSuchElementException(
                        "Transfer not found: " + transferId));

        return toSummary(transfer);
    }

    @Transactional(readOnly = true)
    public List<TransferSummary> getWalletHistory(Long walletId) {
        requirePositiveId(walletId, "Wallet ID");

        if (!walletRepository.existsById(walletId)) {
            throw new NoSuchElementException("Wallet not found: " + walletId);
        }

        return transferRepository.findHistoryByWalletId(walletId)
                .stream()
                .map(this::toSummary)
                .toList();
    }

    private Wallet findWallet(Long walletId) {
        return walletRepository.findById(walletId)
                .orElseThrow(() -> new NoSuchElementException(
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
                    "Transfer amount must be greater than zero.");
        }

        if (amount.compareTo(MAX_BALANCE) > 0) {
            throw new IllegalArgumentException("Transfer amount is too large.");
        }

        try {
            return amount.setScale(2, RoundingMode.UNNECESSARY);
        } catch (ArithmeticException exception) {
            throw new IllegalArgumentException(
                    "Amount must use whole cents, for example 100.50.",
                    exception);
        }
    }

    private TransferSummary toSummary(Transfer transfer) {
        return new TransferSummary(
                transfer.getId(),
                transfer.getReference(),
                transfer.getSenderWallet().getId(),
                transfer.getReceiverWallet().getId(),
                transfer.getAmount(),
                transfer.getCurrency(),
                transfer.getCreatedAt()
        );
    }

    public record TransferSummary(
            Long id,
            String reference,
            Long senderWalletId,
            Long receiverWalletId,
            BigDecimal amount,
            String currency,
            Instant createdAt
    ) {}
}
