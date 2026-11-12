# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Company or installation managers responsible for organizing employees and shift coverage. The user confirmed this audience and goal based on the existing product implementation; more specific industries and user roles are not established.

## Product Purpose

Cuadrant supports planning employee schedules across companies and their installations. Its success is helping responsible users organize shifts and staffing for each installation.

## Positioning

The product is organized around installation-scoped employee, job-role, work-area, shift-template, and schedule records. A distinct market positioning beyond this mechanism is undecided.

## Operating Context

Users configure companies and installations, maintain employee and shift resources, and create schedule entries. Planning data is scoped to an installation within a company.

## Capabilities and Constraints

- Manage companies, installations, employees, job roles, work areas, shift templates, staffing requirements, and schedule entries.
- Schedule entries are associated with employees and job roles, may include work areas or shift templates, and cannot overlap for the same employee.
- User access is authenticated; company membership/roles and resource permissions are enforced. Authentik is used for identity/OIDC integration, with OpenFGA used for authorization checks.
- The deployed architecture uses an Angular web frontend and Django REST backend with PostgreSQL. Authentik and OpenFGA are external services in the documented deployment.
- The product's specific labor-law, payroll, optimization, and industry requirements are not established; do not assume or claim them.

## Brand Commitments

The product is referred to as Cuadrant in the project configuration and repository context. No further voice or brand constraints are established.

## Evidence on Hand

The repository contains the implemented frontend, backend domain models, API, tests, and deployment documentation. It does not establish customer testimonials, outcome metrics, or other marketing evidence; do not fabricate these.

## Product Principles

- Keep planning resources and schedules scoped to the correct installation and company.
- Respect employee-role relationships and prevent overlapping assignments for an employee.
- Apply authenticated, role-aware access to company and installation data.
- Treat unconfirmed business rules and product claims as undecided rather than inventing them.
