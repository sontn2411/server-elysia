ALTER TABLE `users` ADD `status` enum('ACTIVE','LOCKED') DEFAULT 'ACTIVE';--> statement-breakpoint
ALTER TABLE `users` ADD `isAdmin` boolean DEFAULT false;