CREATE TABLE `container_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`startup_order` int NOT NULL DEFAULT 0,
	`startup_delay` int NOT NULL DEFAULT 0,
	`monitor` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `container_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `global_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`check_interval` int NOT NULL DEFAULT 60,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `global_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`container_name` varchar(255) NOT NULL,
	`event_type` enum('startup','restart','status_check','error') NOT NULL,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `logs_id` PRIMARY KEY(`id`)
);
