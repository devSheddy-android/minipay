package com.devsheddy.minipay.controllers;

import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.devsheddy.minipay.services.TransferService;
import com.devsheddy.minipay.services.TransferService.TransferSummary;

@RestController
@RequestMapping("/api/transfers")
public class TransferController {

    private final TransferService transferService;

    public TransferController(TransferService transferService) {
        this.transferService = transferService;
    }

    @PostMapping
    public ResponseEntity<TransferSummary> createTransfer(
            @RequestBody CreateTransferRequest request) {

        TransferSummary transfer = transferService.createTransfer(
                request.senderWalletId(),
                request.receiverWalletId(),
                request.amount()
        );

        URI location = URI.create("/api/transfers/" + transfer.id());
        return ResponseEntity.created(location).body(transfer);
    }

    @GetMapping("/{transferId}")
    public TransferSummary getTransferById(
            @PathVariable("transferId") Long transferId) {

        return transferService.getTransferById(transferId);
    }

    @GetMapping("/wallet/{walletId}")
    public List<TransferSummary> getWalletHistory(
            @PathVariable("walletId") Long walletId) {

        return transferService.getWalletHistory(walletId);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(
            IllegalArgumentException exception) {

        return ResponseEntity.badRequest()
                .body(Map.of("message", exception.getMessage()));
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(
            NoSuchElementException exception) {

        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("message", exception.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleConflict(
            IllegalStateException exception) {

        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message", exception.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDatabaseConflict(
            DataIntegrityViolationException exception) {

        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message",
                        "Transfer data conflicts with an existing record."));
    }

    @ExceptionHandler(ConcurrencyFailureException.class)
    public ResponseEntity<Map<String, String>> handleConcurrentUpdate(
            ConcurrencyFailureException exception) {

        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message",
                        "Transfer conflicted with another request. "
                                + "Check both balances before trying again."));
    }

    public record CreateTransferRequest(
            Long senderWalletId,
            Long receiverWalletId,
            BigDecimal amount
    ) {}
}
